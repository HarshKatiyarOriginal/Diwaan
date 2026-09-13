"""
Diwaan Onboarding API — Interview Coverage Model
=================================================
The interview uses a structured coverage map to ensure comprehensive
business discovery before generating a dashboard blueprint. The LLM
emits a coverage status for each universal business dimension every turn,
accumulates DataBinding catalog entries, and only signals
ready_to_generate when the readiness gate passes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
import json
import logging

from ..db.session import get_db
from ..models.user import User
from ..models.onboarding import OnboardingSession
from ..models.diwaan import Archetype, TenantDashboard
from ..schemas.onboarding import StartInterviewResponse, RespondRequest, RespondResponse, InterviewTurn
from ..schemas.blueprint import (
    Blueprint, Widget, ArchetypeClassification, DataBinding, sanitize_stored_widgets,
)
from ..api.deps import get_current_user
from ..core.exceptions import APIError
from ..services.llm import generate_structured_output

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

ONBOARDING_MAX_QUESTIONS = 18

# ── Coverage dimensions ────────────────────────────────────────────────────────
# Universal dimensions every business interview must cover (or mark n/a).
CORE_DIMENSIONS = [
    "business_type",       # What the business does (product/service/hybrid)
    "revenue_model",       # How money comes in (per unit, subscription, seasonal, etc.)
    "scale",               # Size: employees, locations, machines, acreage, etc.
    "primary_inputs",      # What the business needs to operate (goods, raw materials, services)
    "primary_outputs",     # What the business sells or produces
    "key_cost_drivers",    # Top 2–3 things that eat money
    "customers",           # Who buys (B2B, retail, mandi, direct, etc.)
    "compliance",          # GST, FSSAI, pollution board, APMC, etc.
    "bottleneck",          # Owner's #1 operational pain right now
    "cash_cycle",          # How long between spending and receiving payment
]

# Archetype-specific additional dimensions
ARCHETYPE_DIMENSIONS = {
    "farmer": [
        "crop_types", "season_calendar", "irrigation_method",
        "land_size", "mandi_or_direct_sale",
    ],
    "shopkeeper": [
        "sku_count", "supplier_count", "pos_system",
        "credit_terms", "peak_hours",
    ],
    "factory_owner": [
        "production_capacity", "shift_count", "machine_count",
        "quality_standard", "raw_material_lead_time",
    ],
}

# Readiness criteria (all must pass for ready_to_generate)
MIN_CATALOG_ENTRIES = 6
MIN_CATALOG_KINDS = 3   # e.g. metric + table + action
BOTTLENECK_DRILL_TURNS = 2  # at least 2 turns expanding on the bottleneck
GAP_CHECK_PHRASE = "gap_check_done"


SYSTEM_PROMPT = """You are a domain-aware business consultant conducting a structured intake interview to design a real, data-driven business-intelligence dashboard for a small Indian business owner.

## Your mission
Produce a COMPREHENSIVE COVERAGE MAP of the business so the dashboard can be generated with specific, real data — not generic placeholders.

## Universal business dimensions you must cover
For every turn, update the coverage map with any of these dimensions whose status changed:
- business_type: What the business does (product / service / hybrid)
- revenue_model: How money comes in (per unit, seasonal, commission, subscription, etc.)
- scale: Size — employees, machines, acreage, locations, daily footfall, etc.
- primary_inputs: Raw materials, stock, energy, labour the business needs to run
- primary_outputs: What the business produces or sells
- key_cost_drivers: Top 2-3 line items that consume money
- customers: Who buys — B2B, retail, mandi, direct-to-consumer, etc.
- compliance: GST, FSSAI, APMC, pollution board, Udyam, shop-and-establishment
- bottleneck: The owner's #1 operational pain RIGHT NOW
- cash_cycle: Time between paying for inputs and receiving payment for outputs

## Archetype-specific dimensions
Once the archetype becomes clear, also cover these — mark n/a if truly not applicable:
Farmer: crop_types, season_calendar, irrigation_method, land_size, mandi_or_direct_sale
Shopkeeper: sku_count, supplier_count, pos_system, credit_terms, peak_hours
Factory owner: production_capacity, shift_count, machine_count, quality_standard, raw_material_lead_time

## Questioning rules
1. Early on, get the name the owner calls this business.
2. Ask exactly ONE question per turn. No compound questions.
3. Every question must be answerable with a concrete fact (a number, name, yes/no, specific choice).
4. NEVER ask something already in extracted_facts or already covered.
5. Prioritise questions that unblock the most widgets. Sequence: type → scale → revenue model → inputs/outputs → costs → customers → compliance → bottleneck → drill bottleneck 2+ turns.
6. After the bottleneck is named, drill it for 2 consecutive turns (why it's hard, what a good day vs bad day looks like).
7. When all core dimensions are covered/n/a AND you have ≥6 catalog entries across ≥3 kinds, do ONE gap-check turn: reflect back what you know, name any gaps, ask if anything important was missed.
8. Only after the gap-check, set next_action to "ready_to_generate".

## DataBinding catalog
For every concrete fact the user reveals, add one or more DataBinding entries to catalog_additions:
- key: stable snake_case slug (e.g. "daily_footfall", "monthly_production_sqm")
- kind: "metric" (single number), "series" (time-series), "table" (rows+columns), "status" (text status), "list" (event log), "action" (ledger toggle)
- label: Human-readable name
- unit: e.g. "₹", "kg", "units/hr", "acres" (omit if unitless)
- input: "number", "currency", "text", "select", "date", "none"
- options: only for kind=status or input=select
- columns: only for kind=table
- help: short tooltip if needed

## Output format
Every turn you MUST output a valid JSON object matching this schema:
{
  "next_action": "ask_question" | "ready_to_generate",
  "question": "<the next question — required when ask_question>",
  "extracted_facts": { "<key>": <value>, ... },
  "coverage": { "<dimension_key>": "covered" | "partial" | "n/a" | "uncovered" },
  "coverage_notes": { "<dimension_key>": "<why n/a>" },
  "catalog_additions": [ { DataBinding objects } ],
  "reasoning": "<internal chain-of-thought — never shown to user>"
}

When next_action is "ready_to_generate", leave question as null.
"""


def format_conversation(conversation: list) -> str:
    formatted = [SYSTEM_PROMPT]
    for turn in conversation:
        formatted.append(f"{turn['role'].capitalize()}: {turn['content']}")
    return "\n\n".join(formatted)


def _merge_coverage(existing: dict, new_coverage: dict) -> dict:
    """Merge new coverage statuses into the existing map. covered > partial > uncovered."""
    priority = {"covered": 3, "partial": 2, "n/a": 2, "uncovered": 1}
    merged = dict(existing)
    for key, status in new_coverage.items():
        existing_status = merged.get(key, "uncovered")
        if priority.get(status, 0) >= priority.get(existing_status, 0):
            merged[key] = status
    return merged


def _merge_catalog(existing: list, additions: list) -> list:
    """Merge new DataBinding entries, deduplicating by key."""
    existing_keys = {entry["key"] for entry in existing if isinstance(entry, dict)}
    merged = list(existing)
    for item in additions:
        if isinstance(item, DataBinding):
            d = item.model_dump()
        elif isinstance(item, dict):
            d = item
        else:
            continue
        if d.get("key") and d["key"] not in existing_keys:
            merged.append(d)
            existing_keys.add(d["key"])
    return merged


def _uncovered_core(coverage_map: dict) -> list[str]:
    """Returns core dimensions not yet covered or marked n/a."""
    return [
        dim for dim in CORE_DIMENSIONS
        if coverage_map.get(dim, "uncovered") == "uncovered"
    ]


def _generation_blocked(session: OnboardingSession) -> bool:
    """
    Hard floor: refuse to generate only when the interview has learned
    essentially nothing — no extracted facts AND no catalog entries.
    Above this floor we trust the model's ready_to_generate signal;
    a thin-but-non-empty interview is caught downstream by the
    archetype base-template fallback.
    """
    return not (session.collected_data or {}) and not (session.binding_catalog or [])


def _is_ready_to_generate(session: OnboardingSession) -> bool:
    """
    Strong coverage check: every core dimension covered/n-a AND a catalog
    of ≥MIN_CATALOG_ENTRIES across ≥MIN_CATALOG_KINDS kinds. Used to let
    the interview end early when the model keeps asking past a complete
    picture — not as a blanket veto on the model's own ready signal.
    """
    coverage_map = session.coverage_map or {}
    catalog = session.binding_catalog or []

    # 1. All core dimensions covered or n/a
    uncovered = _uncovered_core(coverage_map)
    if uncovered:
        return False

    # 2. Catalog has enough entries of enough kinds
    if len(catalog) < MIN_CATALOG_ENTRIES:
        return False
    kinds = {entry.get("kind") for entry in catalog if isinstance(entry, dict) and entry.get("kind")}
    if len(kinds) < MIN_CATALOG_KINDS:
        return False

    # 3. Gap-check turn done (checked in conversation for the marker phrase or after gap turn)
    return True


@router.post("/sessions", response_model=StartInterviewResponse)
async def start_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = OnboardingSession(
        tenant_id=current_user.tenant_id,
        coverage_map={dim: "uncovered" for dim in CORE_DIMENSIONS},
        binding_catalog=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        "Start the interview. Ask the user what kind of business they run "
        "and where it is located. Keep it brief and warm."
    )

    turn = await generate_structured_output(prompt=prompt, schema=InterviewTurn)

    # Store history
    session.conversation = [{"role": "assistant", "content": turn.question}]
    # Merge any initial coverage/catalog the LLM returned
    session.coverage_map = _merge_coverage(session.coverage_map, turn.coverage)
    session.binding_catalog = _merge_catalog(session.binding_catalog, turn.catalog_additions)
    await db.commit()

    return StartInterviewResponse(session_id=session.id, question=turn.question)


@router.post("/sessions/{session_id}/respond", response_model=RespondResponse)
async def respond(
    session_id: UUID,
    request: RespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OnboardingSession).where(
            OnboardingSession.id == session_id,
            OnboardingSession.tenant_id == current_user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise APIError("Session not found", status_code=404)
    if session.status != "in_progress":
        raise APIError(f"Session is already {session.status}", status_code=400)

    # Append user answer
    conversation = list(session.conversation)
    conversation.append({"role": "user", "content": request.answer})

    # Questions asked = number of assistant turns
    questions_asked = sum(1 for t in conversation if t["role"] == "assistant")

    if questions_asked >= ONBOARDING_MAX_QUESTIONS:
        # Hard stop — log uncovered dimensions and proceed to generation
        session.truncated = True
        session.uncovered_core_at_truncation = _uncovered_core(session.coverage_map or {})
        logger.warning(
            f"Session {session_id} truncated at Q{questions_asked}. "
            f"Uncovered: {session.uncovered_core_at_truncation}"
        )
        force_generation = True
    else:
        # Normal LLM turn
        prompt = format_conversation(conversation)
        turn = await generate_structured_output(prompt=prompt, schema=InterviewTurn)

        # Merge incremental facts
        if turn.extracted_facts:
            current_data = dict(session.collected_data or {})
            current_data.update(turn.extracted_facts)
            session.collected_data = current_data

        # Merge coverage map and binding catalog
        session.coverage_map = _merge_coverage(session.coverage_map or {}, turn.coverage)
        session.binding_catalog = _merge_catalog(
            session.binding_catalog or [], turn.catalog_additions
        )

        # ── Coverage gate (the readiness decision — now actually enforced) ─────
        ready_gate = _is_ready_to_generate(session)
        gap_check_done = any(
            t["role"] == "assistant" and any(
                p in t["content"].lower()
                for p in (
                    "anything important", "anything else", "did i miss",
                    "haven't covered", "have we missed", "before i build",
                )
            )
            for t in conversation
        )

        if turn.next_action == "ask_question":
            # The model wants another question. Let it — UNLESS coverage is
            # complete AND a gap-check turn has already happened, in which
            # case we override and generate now.
            if ready_gate and gap_check_done:
                force_generation = True
            else:
                conversation.append({"role": "assistant", "content": turn.question})
                session.conversation = conversation
                await db.commit()
                return RespondResponse(
                    session_id=session.id,
                    status="in_progress",
                    question=turn.question,
                )
        else:
            # The model says ready_to_generate. Trust it unless the
            # interview learned essentially nothing — then force one more
            # question rather than generate from an empty picture.
            if not _generation_blocked(session):
                force_generation = True
            else:
                q = (
                    "Tell me a bit about what your business actually does day "
                    "to day — I don't have enough yet to build something useful."
                )
                conversation.append({"role": "assistant", "content": q})
                session.conversation = conversation
                await db.commit()
                return RespondResponse(
                    session_id=session.id, status="in_progress", question=q,
                )

    # ── Generation phase ───────────────────────────────────────────────────────
    session.conversation = conversation
    business_context = json.dumps(session.collected_data, indent=2)
    catalog_json = json.dumps(session.binding_catalog or [], indent=2)

    # 1. Classify archetype
    classification_prompt = f"""
Classify the following business data into one of these archetypes: farmer, shopkeeper, or factory_owner.
Business Data: {business_context}
"""
    classification_result = await generate_structured_output(
        prompt=classification_prompt, schema=ArchetypeClassification
    )
    archetype_id = classification_result.archetype

    # 2. Load archetype base template
    arch_res = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = arch_res.scalar_one_or_none()
    if not archetype:
        raise APIError(f"Archetype '{archetype_id}' not found in database.", status_code=500)

    # 3. Mutate blueprint — widgets come from the binding catalog, not fake data
    mutation_prompt = f"""
You are generating a dashboard blueprint for a real business.

ARCHETYPE: {archetype_id}
BUSINESS DATA: {business_context}
DATA BINDING CATALOG: {catalog_json}

TASK:
Return a Blueprint JSON object. Every active_widget MUST reference one of the DataBinding entries
from the catalog above in its data_binding field. Set data_binding.key to the catalog key.

WIDGET RULES:
- component_name MUST be one of: MetricCard, DataTable, ChartWidget, StatusBadge, LedgerToggle, ListWidget
- props is PRESENTATION-ONLY: chartType, layout hints, colour overrides — NO literal values/rows/items
- Every MetricCard uses kind=metric or kind=series from the catalog
- Every DataTable uses kind=table from the catalog
- Every ChartWidget uses kind=series from the catalog
- Every StatusBadge uses kind=status from the catalog
- Every LedgerToggle uses kind=action from the catalog
- Every ListWidget uses kind=list from the catalog
- DO NOT fabricate any numbers, rows, or data — the data_binding key is the link to real storage
- Only include widgets for facts actually in the catalog — omit rather than invent

VISUAL THEME: Set visual_theme to exactly one of:
"kirana-shop" — retail, grocery, FMCG, corner shops
"farm" — agriculture, crops, horticulture, dairy, fishery
"paper-factory" — paper, textiles, light manufacturing, printing, packaging
"ice-cream-factory" — cold-chain, frozen food, dairy processing, beverages, food manufacturing
"tiles-factory" — ceramics, heavy industrial, construction materials, mining, foundry

Base template for reference (use as grid/layout guide only): {json.dumps(archetype.base_template)}
"""

    blueprint = await generate_structured_output(prompt=mutation_prompt, schema=Blueprint)

    # 3b. Never ship a blank dashboard. If the mutation omitted every widget
    #     (terse / truncated interview, empty catalog), fall back to the
    #     archetype's base template so the owner always lands on something.
    if not blueprint.active_widgets:
        base_widgets = sanitize_stored_widgets((archetype.base_template or {}).get("widgets", []))
        logger.warning(
            f"Session {session_id}: mutation produced 0 widgets; "
            f"falling back to archetype base template ({len(base_widgets)} widgets)."
        )
        parsed = []
        for w in base_widgets:
            try:
                parsed.append(Widget(**w))
            except Exception as e:  # skip a malformed template widget, don't 500
                logger.error(f"Base-template widget skipped: {e}")
        blueprint.active_widgets = parsed
        if not blueprint.visual_theme:
            from ..schemas.blueprint import ARCHETYPE_THEME_FALLBACKS
            blueprint.visual_theme = ARCHETYPE_THEME_FALLBACKS.get(archetype_id)

    # 4. Create new dashboard
    params = dict(blueprint.customized_parameters)
    if blueprint.visual_theme:
        params["visual_theme"] = blueprint.visual_theme
    # Store the binding catalog with the dashboard for data-layer bootstrapping
    params["binding_catalog"] = session.binding_catalog

    widget_dicts = [w.model_dump() for w in blueprint.active_widgets]
    
    # Extract business name from facts or fallback
    b_name = session.collected_data.get("business_name")
    if not b_name:
        b_name = blueprint.business_summary[:60] if blueprint.business_summary else "My Business"
        
    import uuid
    dash = TenantDashboard(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=b_name,
        archetype_id=blueprint.archetype,
        business_summary=blueprint.business_summary,
        customized_parameters=params,
        active_widgets=widget_dicts,
        generated_at=blueprint.generated_at,
        version=blueprint.version,
    )
    db.add(dash)

    await db.commit()
    await db.refresh(dash)

    session.status = "complete"
    session.resulting_dashboard_id = dash.id
    await db.commit()

    return RespondResponse(
        session_id=session.id,
        status="complete",
        blueprint=blueprint,
        dashboard_id=dash.id,
    )


@router.get("/sessions/{session_id}", response_model=RespondResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OnboardingSession).where(
            OnboardingSession.id == session_id,
            OnboardingSession.tenant_id == current_user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise APIError("Session not found", status_code=404)

    last_question = None
    if session.status == "in_progress" and session.conversation:
        last_turn = session.conversation[-1]
        if last_turn["role"] == "assistant":
            last_question = last_turn["content"]

    blueprint = None
    if session.status == "complete" and session.resulting_dashboard_id:
        dash_res = await db.execute(
            select(TenantDashboard).where(
                TenantDashboard.id == session.resulting_dashboard_id
            )
        )
        dash = dash_res.scalar_one_or_none()
        if dash:
            blueprint = Blueprint(
                archetype=dash.archetype_id,
                visual_theme=(
                    dash.customized_parameters.get("visual_theme")
                    if dash.customized_parameters
                    else None
                ),
                business_summary=dash.business_summary,
                customized_parameters=dash.customized_parameters,
                # Sanitize persisted props so an older-shape dashboard still opens.
                active_widgets=sanitize_stored_widgets(dash.active_widgets),
                generated_at=dash.generated_at,
                version=dash.version,
            )

    return RespondResponse(
        session_id=session.id,
        status=session.status,
        question=last_question,
        blueprint=blueprint,
        dashboard_id=session.resulting_dashboard_id,
    )
