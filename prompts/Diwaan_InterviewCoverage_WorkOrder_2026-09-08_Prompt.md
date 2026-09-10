# Diwaan — the onboarding interview, made genuinely comprehensive
## Companion to `Diwaan_FunctionalDashboard...`. That one defines what the interview must *produce*; this one defines how it *covers the whole business* to get there.

**Written:** 2026-09-08
**For:** implementer (Antigravity or equivalent)
**Goal:** A practical dashboard can only be as good as what the interview
learns. Today the interview runs off one loose system prompt with no
model of *what a complete picture of a business looks like* — so it can
finish having asked four questions about products and none about cash,
labour, or the owner's actual bottleneck. This pass gives the interview a
**structured coverage model**: a checklist of every operational dimension
a business has, adaptive prioritisation of which ones matter for *this*
business, and a readiness test based on coverage rather than a question
count. The output contract (the `DataBinding` catalog) is defined in the
companion work order — this pass makes sure that catalog is *complete*.

---

## 0. Current state — read before touching anything

`backend/api/onboarding.py`:
- One `SYSTEM_PROMPT` — decent instincts ("ground questions in reality",
  "one concrete-answerable question at a time", "don't re-ask", "prefer
  questions that map to a widget") but **no coverage model**. Nothing
  tracks which aspects of the business have and haven't been explored.
- `ONBOARDING_MAX_QUESTIONS = 15` is the only stopping rule besides the
  model volunteering `ready_to_generate`. "Enough" is defined by
  question count, not by what's been learned.
- `InterviewTurn.extracted_facts` accumulates loose key/values onto
  `session.collected_data`. No structure, no gap awareness.
- The classify step picks one of `farmer` / `shopkeeper` / `factory_owner`
  *after* the interview — the interview itself doesn't use the archetype
  to steer questioning.

Result: coverage is luck of the draw.

---

## 1. The coverage model — the dimensions every interview must account for

Define a **coverage checklist** the interview tracks turn by turn. Every
dimension is one of: `covered` (have concrete facts), `partial` (touched,
needs depth), `n/a` (explicitly determined irrelevant for this business),
`uncovered`. The interview cannot reach `ready_to_generate` with any
`core` dimension still `uncovered` (see §3).

### 1.1 Universal dimensions (probe for every business)

| Dimension | Tier | What "covered" means |
|---|---|---|
| **Core offering** | core | What they make / sell / do; main products or service lines; unit of measure (kg, piece, m², hour, litre) |
| **Scale & capacity** | core | Output volume or throughput per day/week/month; rough revenue band; capacity ceiling |
| **Revenue & sales** | core | How money comes in; channels (retail / wholesale / B2B / mandi / export / online); pricing basis; payment terms; receivables / credit given to customers |
| **Costs & inputs** | core | Top 3–5 cost drivers; key raw materials / inputs and their unit; utilities; rent; recurring bills |
| **Inventory / stock** | core *(unless pure service)* | What's held; how quantified; reorder thresholds; spoilage / wastage; storage limits |
| **People & labour** | core | Headcount; permanent vs contract / daily-wage; shifts; roles; payroll cadence; attendance tracking |
| **Suppliers & procurement** | core | Key suppliers; order cadence; lead times; single-source risks |
| **Equipment & assets** | core *(unless none)* | Machines / vehicles / tools; which are critical; runtime, downtime, breakdowns, maintenance |
| **Cash & working capital** | core | Daily cash position awareness; bank balance; loans / EMIs; credit lines |
| **Compliance & statutory** | core | GST / tax filing cadence; licences; inspections; certifications; safety obligations |
| **Facilities & sites** | secondary | Single vs multiple locations; land / floor area; layout constraints |
| **Quality & returns** | secondary | Defect / reject rate; returns; complaints; standards they're held to |
| **Seasonality & cycles** | secondary | Peak / lean periods; cycles (crop, festival, monsoon, financial year) |
| **Customers** | secondary | Who; concentration (few big vs many small); repeat vs one-off |
| **Owner's bottleneck** | core | The thing the owner themself says costs them money / sleep. Asked explicitly. Drilled into. |
| **Goals** | secondary | What "a good month" looks like; what they want to grow or cut |

`core` = must be `covered` or explicitly `n/a` before generating.
`secondary` = probe if question budget allows and the answers so far
suggest it matters.

### 1.2 Archetype layers (add once the offering makes the archetype clear)

- **Farmer:** land parcels & tenure (owned / leased / share); crop rotation
  & current stage per parcel; water source & irrigation; input schedule
  (seed / fertiliser / pesticide) & costs; weather exposure; harvest
  timing; equipment (tractor / pump / thresher); livestock; mandi / buyer
  & price basis.
- **Shopkeeper:** footfall / billing volume per day; fast vs slow movers;
  shelf / storage space; billing method (barcode POS / manual); home
  delivery; credit-book (udhaar) customers & outstanding; festival / season
  stocking; supplier van / restock cadence.
- **Factory owner:** production stages / line; machine-by-machine runtime &
  criticality; raw-material → WIP → finished flow; shift scheduling &
  manpower per shift; energy load (kiln / furnace / boiler / compressor);
  batch / lot tracking; scrap & rework rate; dispatch / logistics;
  subcontracting.

### 1.3 Sub-vertical specialisation (the tile-plant-vs-dairy point)

Once the specific business is clear, the interview asks **2–4
sub-vertical-specific questions** that a generic archetype interview would
never think of:
- Tile / ceramics plant → kiln temperature per firing; firing cycle
  length; glaze line status; clay-body moisture; breakage in transit.
- Dairy / cold processing → cold-storage temperature; milk fat / SNF
  testing; collection routes & volumes; pasteurisation batches; pack
  dating / shelf life.
- Bakery → oven batches per day; proving times; daily wastage / unsold;
  ingredient stock (flour / sugar / butter) in days-of-cover.
- Print shop → jobs in queue; machine (press / plotter) uptime;
  consumables (ink / paper) stock; rush vs standard turnaround.

These are examples — the model should generate the right specific
questions for whatever the business actually is, driven by the offering.

---

## 2. How the interview runs

Rewrite the questioning loop in `backend/api/onboarding.py` around the
coverage model:

1. **Open broad, then branch.** First 1–2 questions establish the core
   offering, unit of measure, and rough scale. From the answers, infer
   the likely archetype and activate its §1.2 layer + start forming
   sub-vertical questions.
2. **Prioritise by leverage, not by list order.** Each turn, pick the
   `uncovered`/`partial` dimension that will most change the dashboard for
   *this* business, given what's known. A pure-service business marks
   Inventory / Equipment `n/a` early and spends those turns on People,
   Receivables, Utilisation instead. Record *why* a dimension was marked
   `n/a`.
3. **Drill the bottleneck.** When the owner names a pain point, spend 2–3
   consecutive turns there — that becomes a headline widget. This is the
   single highest-value part of the interview; protect budget for it.
4. **One concrete question at a time, plain language, local vocabulary.**
   Keep the existing good rules. Use Indian-SMB terms where natural
   (mandi, udhaar / credit book, GST, quintal, bigha / katha, lakh) — no
   MBA jargon, no "tell me more".
5. **Never re-ask.** Check accumulated facts + coverage state before every
   question (existing rule — keep and strengthen; the coverage state
   makes it enforceable).
6. **Gap-check before generating.** When coverage criteria are met (§3),
   ask **one** reflect-back question: "Here's what I'll build your
   dashboard to track: [list]. Anything important to your business that's
   missing?" — then incorporate the answer, then `ready_to_generate`.
   Skip this only if the question budget is exhausted.

The turn schema (`InterviewTurn`) carries the coverage state so it
persists on the session and is visible for logging / debugging:
`coverage: dict[str, Literal["covered","partial","n/a","uncovered"]]`
plus `coverage_notes` (why anything is `n/a`).

---

## 3. Readiness — coverage, not question count

`ready_to_generate` is allowed only when **all** hold:
- Every `core` dimension (§1.1) is `covered` or `n/a`-with-reason.
- The active archetype layer (§1.2) has its main items `covered`/`n/a`.
- At least 2 sub-vertical questions (§1.3) have been asked when the
  business is specific enough to have a sub-vertical.
- The owner's bottleneck has been named and drilled.
- The accumulated `DataBinding` catalog (from the companion work order)
  has **at least 6** entries spanning at least 3 different `kind`s.
- The gap-check turn (§2.6) has been done, or the budget is exhausted.

`ONBOARDING_MAX_QUESTIONS = 15` stays as a **hard stop**: if it's hit
before the criteria are met, generate anyway, set `session.truncated =
True`, and have the mutation prompt lean on the archetype's default
catalog for whatever's missing — but log which `core` dimensions were
still `uncovered` so this is measurable.

Consider raising the cap to **18** — the coverage model plus a gap-check
turn is tight at 15. Do not go past 20; interview fatigue is real.

---

## 4. Keep the guardrails

- Still `generate_structured_output` + `InterviewTurn` schema every turn,
  still the validate-then-retry-once contract from `services/llm.py`.
- Coverage state and the catalog are additive to the existing
  `collected_data` merge — don't drop the fact accumulation that already
  works.
- No fabricated facts: if the user won't answer something, mark it
  `partial` / `n/a` and move on — never invent a value to fill coverage.
- The interview still can't invent component names or emit literal data
  values (enforced in the companion work order's schema).
- Don't regress the five prior fix passes or the existing onboarding /
  visual-theme tests.

---

## 5. Tests — run whole businesses through, assert coverage

Add interview-simulation tests (mock the LLM with scripted answer sets):

- **Kirana shop, 2 staff, credit book, festival stocking** → coverage
  reaches all `core` + shopkeeper layer; catalog includes a
  receivables/udhaar binding, a fast-mover table, a daily-sales metric.
- **20-acre farm, wheat + mustard rotation, leased land, tractor** →
  land-parcel + crop-stage + irrigation + input-cost + mandi-price
  coverage; Inventory partially `n/a` (no packaged stock), reasons logged.
- **Ceramic tile plant, 50 workers, 2 kilns, exports** → factory layer +
  sub-vertical questions about kiln temperature / firing cycles / breakage;
  catalog has kiln-temp metric, firing-batch table, dispatch/logistics.
- **Freelance accounting practice, 1 person, no inventory, no equipment**
  → Inventory / Equipment / Suppliers marked `n/a` with reasons; turns
  redirected to receivables, billable-hours, client concentration,
  filing-deadline compliance.
- **Truncation case:** feed evasive one-word answers → hits the 18-cap,
  `truncated = True`, still produces a valid blueprint, logs the
  `uncovered` core dimensions.

Assert on the final `coverage` map and the `DataBinding` catalog, not on
exact question wording.

---

## 6. Acceptance checklist

- [ ] `InterviewTurn` carries a `coverage` map + `coverage_notes`;
      persisted on the session.
- [ ] The system prompt encodes the §1 dimension model, the archetype
      layers, and the instruction to generate sub-vertical-specific
      questions.
- [ ] Questioning branches: irrelevant dimensions get marked `n/a` with a
      logged reason instead of being asked.
- [ ] The owner's bottleneck is always explicitly asked and drilled.
- [ ] A gap-check reflect-back turn happens before `ready_to_generate`
      (budget permitting).
- [ ] `ready_to_generate` is gated on the §3 coverage criteria, not
      question count; the 15→18 hard cap still forces a valid blueprint
      and flags `truncated` + logs uncovered core dimensions.
- [ ] The 5 interview-simulation tests pass, asserting on coverage maps
      and catalog composition.
- [ ] Existing `pytest` + `npm test` suites stay green.
- [ ] Delivery notes: transcripts of all 5 simulated interviews with
      their final coverage maps and generated catalogs.
