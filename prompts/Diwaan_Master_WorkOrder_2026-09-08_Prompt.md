# Diwaan — Master Work Order
## The interview, the generated dashboard, and the visual system — one pass, in this order of priority.
### Supersedes and combines: `Diwaan_InterviewCoverage...`, `Diwaan_FunctionalDashboard...`, `Diwaan_IconicUI_Maximal...` (all 2026-09-08)

**Written:** 2026-09-08
**For:** implementer (Antigravity or equivalent)

**The one-paragraph brief:** Diwaan's promise is that a conversation with a
business owner produces a *practical, working dashboard specific to that
business*. Right now: the interview has no model of what a complete
picture of a business is, so coverage is luck of the draw; the generated
dashboard is a static mockup full of fake numbers with widgets that do
nothing when clicked; and the UI, while tidy, isn't the iconic thing the
product is meant to be. This work order fixes all three, **in dependency
order** — the interview feeds the dashboard's data model, the dashboard
is the point of the product, and the visual pass must not regress either.

**Sequencing:** Part I and Part II are the priority and are coupled — do
them together. Part III comes after and must leave every Part I/II
guarantee intact. All three share the constraints in §HARD.

---

## 0. Current state — verified by reading the code and running the app; read before touching anything

**Stack:** FastAPI + SQLAlchemy (async) + SQLite/Postgres + Gemini
(`google-generativeai`) backend; React 19 + Vite 8 frontend, `three`
^0.185 installed, no router, no animation library, plain `useState` views.

### The interview (`backend/api/onboarding.py`)
- One `SYSTEM_PROMPT`. Good instincts (concrete-answerable questions, one
  at a time, don't re-ask, prefer widget-mapping questions) but **no
  coverage model** — nothing tracks which aspects of the business have
  been explored.
- `ONBOARDING_MAX_QUESTIONS = 15` is the only stop besides the model
  volunteering `ready_to_generate`. "Enough" = question count, not
  learned facts.
- `InterviewTurn.extracted_facts` accumulates loose key/values onto
  `session.collected_data`. No structure, no gap awareness.
- Archetype is classified *after* the interview; the interview doesn't use
  it to steer.

### The generated dashboard (`frontend/src/BlueprintRenderer.jsx` + widgets)
- One-shot static render: `blueprint.active_widgets[].props` → the 6
  registry components, verbatim, forever. **No data layer.**
- `MetricCard` count-up-animates a `value` **string** the LLM wrote.
  `DataTable` renders a fixed `rows` array, not editable. `LedgerToggle`'s
  own comment: *"For demo purposes, we manage local state... not fully
  wired to a backend"* — a local boolean that does nothing.
  `ChartWidget`/`StatusBadge`/`ListWidget` — same, static props in.
- `TenantDashboard` persists `active_widgets` (layout) and
  `customized_parameters` (JSON) — nothing stores the actual business
  values. `{{acres_under_cultivation}}` never resolves.
- `backend/scripts/seed_archetypes.py` templates contain fake sample data
  (`"450 kg"`, `"Parcel A"`, `"Wheat"`) that ships to the user's screen
  as if it were theirs.

### The visual system
- `frontend/src/styles/tokens.css` — real, good: `--glass-surface-*`,
  `--blur-*`, `--neumorph-primary-*`, `--shadow-elevation-*`,
  `--focus-ring-gold`, `--ease-vault`. **Underused** — mostly only
  SpecShield consumes it.
- `frontend/src/components/ThreeDiwaanSeal.jsx` — a real Three.js scene
  (gold torus rings + octahedron core + 24-point cloud), 120×120,
  `MeshStandardMaterial`, with `prefers-reduced-motion`,
  `webglcontextlost`, and full disposal. **But** tiny, built in code (no
  scene asset), **no post-processing** (no bloom/DoF/env map). Reads as "a
  spinning ring," not a centerpiece. `DiwaanSeal.jsx` routes `large` →
  this with a CSS fallback; `small`/`micro` → CSS rings (correct).
- `frontend/src/components/Toast.jsx` — works (verified live).
- `SpecShield.css` — real `backdrop-filter` glass consuming tokens; the
  strongest screen.
- `OnboardingChat`, `AuthScreen`, the LandingPage hero card, the modals —
  flat hard-edged dark rectangles, mostly inline styles, don't touch
  tokens.
- Theme backgrounds are static placeholder stock photos. No ambient
  motion. Transitions are the vault-door overlay and otherwise opacity
  swaps.

### Live functional debt (fix as part of this pass — "practical" requires it)
- **`GEMINI_MODEL=gemini-1.5-flash` is a dead model.** Confirmed live: the
  API 404s on it (and on `gemini-2.5-flash` for this key) and directs to
  `gemini-3.6-flash`. Update the default + `.env.example`; make
  `services/llm.py` surface a clear error on a 404-model instead of
  hanging the "thinking" state forever.
- **`render.yaml` sets `CORS_ORIGINS: "*"`** — tighten to the deployed
  frontend origin.
- `OnboardingChat.jsx` auto-scroll bug — see Part III §III-6.
- `google-generativeai` prints an end-of-life warning every boot;
  migrating to `google-genai` is out of scope, note it as next infra
  task.

### Already right — preserve exactly
- Closed component vocabulary: `backend/schemas/component_registry.py`
  `AllowedComponent` Literal, mirrored in
  `BlueprintRenderer.COMPONENT_REGISTRY`, with a parity test.
- `services/llm.py` validate-then-retry-once contract.
- The five prior fix passes (JWT base64url decode via
  `frontend/src/api/client.js`; `pending_session_id` surviving a 401
  including during the resume-check GET; `visual_theme` round-trip through
  **both** `GET /api/onboarding/sessions/{id}` and `GET
  /api/dashboards/{tenant_id}`; SpecShield poll-timer cleanup + overlap
  guard + debounce; shared `apiFetch`/`decodeJwtPayload`/`clearSession`
  used by every component; `backend/db/types.py` as the single
  column-type source; `backend/models/__init__.py` importing every model).
- The mutation prompt's rule: *omit a widget rather than fabricate a
  value.* This pass makes it enforced code, not a prompt string.

---

# PART I — The interview: a complete business-coverage model

*A practical dashboard can only be as good as what the interview learns.*

## I-1. The coverage checklist

The interview tracks a **coverage map** turn by turn. Each dimension is
`covered` (concrete facts in hand), `partial` (touched, needs depth),
`n/a` (explicitly determined irrelevant — with a logged reason), or
`uncovered`.

### I-1.1 Universal dimensions (probe for every business)

| Dimension | Tier | "Covered" means |
|---|---|---|
| **Core offering** | core | Products / service lines; unit of measure (kg, piece, m², hr, litre) |
| **Scale & capacity** | core | Output/throughput per day/week/month; rough revenue band; capacity ceiling |
| **Revenue & sales** | core | How money comes in; channels (retail/wholesale/B2B/mandi/export/online); pricing basis; payment terms; receivables / credit given |
| **Costs & inputs** | core | Top 3–5 cost drivers; key raw materials/inputs + unit; utilities; rent; recurring bills |
| **Inventory / stock** | core *(unless pure service)* | What's held; how quantified; reorder thresholds; spoilage/wastage; storage limits |
| **People & labour** | core | Headcount; permanent vs contract/daily-wage; shifts; roles; payroll cadence; attendance |
| **Suppliers & procurement** | core | Key suppliers; order cadence; lead times; single-source risks |
| **Equipment & assets** | core *(unless none)* | Machines/vehicles/tools; which are critical; runtime, downtime, breakdowns, maintenance |
| **Cash & working capital** | core | Daily cash position awareness; bank balance; loans/EMIs; credit lines |
| **Compliance & statutory** | core | GST/tax filing cadence; licences; inspections; certifications; safety |
| **Owner's bottleneck** | core | The thing the owner says costs them money/sleep. Asked explicitly, drilled 2–3 turns — becomes the headline widget. |
| **Facilities & sites** | secondary | Single vs multi-site; land/floor area; layout constraints |
| **Quality & returns** | secondary | Defect/reject rate; returns; complaints; standards |
| **Seasonality & cycles** | secondary | Peak/lean periods; crop/festival/monsoon/FY cycles |
| **Customers** | secondary | Who; concentration (few big vs many small); repeat vs one-off |
| **Goals** | secondary | What "a good month" looks like; what to grow or cut |

`core` = must be `covered` or `n/a`-with-reason before generating.
`secondary` = probe if budget allows and answers suggest it matters.

### I-1.2 Archetype layers (activate once the offering makes the archetype clear)

- **Farmer:** land parcels & tenure (owned/leased/share); crop rotation &
  current stage per parcel; water source & irrigation; input schedule
  (seed/fertiliser/pesticide) & costs; weather exposure; harvest timing;
  equipment (tractor/pump/thresher); livestock; mandi/buyer & price basis.
- **Shopkeeper:** billing volume/footfall per day; fast vs slow movers;
  shelf/storage space; billing method (barcode POS/manual); home
  delivery; credit-book (udhaar) customers & outstanding; festival/season
  stocking; supplier van/restock cadence.
- **Factory owner:** production stages/line; machine-by-machine runtime &
  criticality; raw-material → WIP → finished flow; shift scheduling &
  manpower per shift; energy load (kiln/furnace/boiler/compressor);
  batch/lot tracking; scrap & rework rate; dispatch/logistics;
  subcontracting.

### I-1.3 Sub-vertical specialisation (the tile-plant-vs-dairy point)

Once the specific business is clear, ask **2–4 sub-vertical-specific
questions** a generic archetype interview would never think of. Examples
(generate the right ones for whatever the business actually is):
- Tile/ceramics → kiln temperature per firing; firing cycle length; glaze
  line status; clay-body moisture; breakage in transit.
- Dairy/cold processing → cold-storage temperature; milk fat/SNF testing;
  collection routes & volumes; pasteurisation batches; pack dating/shelf
  life.
- Bakery → oven batches/day; proving times; daily wastage/unsold;
  ingredient days-of-cover (flour/sugar/butter).
- Print shop → jobs in queue; press/plotter uptime; consumables
  (ink/paper) stock; rush vs standard turnaround.

## I-2. How the interview runs

Rewrite the questioning loop around the coverage map:

1. **Open broad, then branch.** First 1–2 questions: core offering, unit
   of measure, rough scale. Infer likely archetype from the answers,
   activate its I-1.2 layer, start forming sub-vertical questions.
2. **Prioritise by leverage, not list order.** Each turn, pick the
   `uncovered`/`partial` dimension that will most change *this* dashboard.
   A pure-service business marks Inventory/Equipment `n/a` early (reason
   logged) and spends those turns on People, Receivables, Utilisation.
3. **Drill the bottleneck.** When a pain point is named, spend 2–3
   consecutive turns there. Highest-value part of the interview — protect
   budget for it.
4. **One concrete question at a time, plain language, local vocabulary**
   (mandi, udhaar/credit book, GST, quintal, bigha/katha, lakh) — no MBA
   jargon, no "tell me more". Keep the existing good rules.
5. **Never re-ask.** Check accumulated facts + coverage state before every
   question.
6. **Gap-check before generating.** When I-3 criteria are met, ask **one**
   reflect-back question: "Here's what I'll build your dashboard to track:
   [list]. Anything important that's missing?" — incorporate the answer,
   then `ready_to_generate`. Skip only if budget is exhausted.

`InterviewTurn` gains `coverage: dict[str, Literal["covered","partial",
"n/a","uncovered"]]` and `coverage_notes` (why anything is `n/a`),
persisted on the session, additive to the existing `collected_data` merge.
It also accumulates `catalog_additions: list[DataBinding]` (Part II) —
each answer can contribute bindings.

## I-3. Readiness — coverage, not question count

`ready_to_generate` allowed only when **all** hold:
- Every `core` dimension `covered` or `n/a`-with-reason.
- Active archetype layer's main items `covered`/`n/a`.
- ≥2 sub-vertical questions asked when the business has a sub-vertical.
- Owner's bottleneck named and drilled.
- The `DataBinding` catalog has **≥6 entries across ≥3 different `kind`s**.
- Gap-check turn done, or budget exhausted.

`ONBOARDING_MAX_QUESTIONS` stays a **hard stop**: raise it to **18** (the
coverage model + gap-check is tight at 15; do not exceed 20). If hit
before criteria are met — generate anyway, set `session.truncated =
True`, have the mutation prompt lean on the archetype's default catalog
for gaps, and **log which `core` dimensions were still `uncovered`** so
it's measurable.

## I-4. Interview tests — run whole businesses through (mock the LLM with scripted answer sets)

- **Kirana shop**, 2 staff, credit book, festival stocking → all `core` +
  shopkeeper layer covered; catalog has a receivables/udhaar binding, a
  fast-mover table, a daily-sales metric.
- **20-acre farm**, wheat+mustard rotation, leased land, tractor →
  land-parcel + crop-stage + irrigation + input-cost + mandi-price
  coverage; Inventory partially `n/a` with logged reasons.
- **Ceramic tile plant**, 50 workers, 2 kilns, exports → factory layer +
  sub-vertical kiln-temp/firing-cycle/breakage questions; catalog has
  kiln-temp metric, firing-batch table, dispatch/logistics.
- **Freelance accounting practice**, 1 person, no inventory/equipment →
  Inventory/Equipment/Suppliers `n/a` with reasons; turns redirected to
  receivables, billable hours, client concentration, filing deadlines.
- **Truncation case:** evasive one-word answers → hits the 18-cap,
  `truncated = True`, still produces a valid blueprint, logs `uncovered`
  core dimensions.

Assert on the final `coverage` map and catalog composition — not exact
question wording.

---

# PART II — The generated dashboard: a real instrument

*The point of the product. Widgets bound to real per-tenant data the user
maintains over time.*

## II-1. Widgets declare a data binding, not a value

A generated widget stops carrying literal data. It carries a validated
**`DataBinding`**. Add to `backend/schemas/blueprint.py`:

```
DataKind = Literal["metric", "series", "table", "status", "list", "action"]

class DataBinding(BaseModel):
    key: str                      # stable slug, e.g. "monthly_production_sqm"
    kind: DataKind
    label: str
    unit: Optional[str] = None
    input: Literal["number","text","currency","select","date","none"] = "number"
    options: list[str] = []       # for kind=status / input=select
    columns: list[str] = []       # for kind=table
    help: Optional[str] = None    # what to enter, in plain language
```

`Widget` gains `data_binding: Optional[DataBinding]`. `props` stays — for
**presentation only** (chart type, number format), never data. `key` is
unique within a dashboard and is the identity that survives regeneration
(II-5). **Schema rejects a blueprint whose widget `props` contains a
literal data value** (e.g. a `MetricCard` with `props.value`, a
`DataTable` with `props.rows`) → triggers the existing retry-once.

## II-2. The data layer (backend)

New models in `backend/models/` — register in `backend/models/__init__.py`,
use `backend/db/types.py`'s `JSONType`/`UUIDType` (do not redefine):

- **`WidgetValue`** — current state per binding: `(tenant_id, key,
  value_json, updated_at, updated_by)`, PK `(tenant_id, key)`.
  `value_json` shape by `kind`: `metric`→number, `status`→one of
  `options`, `table`→list of row objects, `list`→list of item objects,
  `action`→last event ref.
- **`WidgetSeriesPoint`** — history for `metric`/`series`: `(id,
  tenant_id, key, ts, value)`, indexed `(tenant_id, key, ts)`. Every
  `metric` write appends one, so deltas and sparklines are **real** (prev
  point vs current), never LLM guesses.
- **`LedgerEvent`** — for `action`: `(id, tenant_id, key, label,
  fired_at, fired_by, note)`. `LedgerToggle` firing writes one.

Endpoints — all tenant-scoped via `current_user.tenant_id`, all through
the shared error handling:
- `GET /api/dashboards/{tenant_id}/data` → `{ [key]: { value, updated_at,
  series?, history_range } }` for every binding on the dashboard; unset
  keys absent.
- `PUT /api/dashboards/{tenant_id}/data/{key}` → set a value (validated
  against the binding's `kind`/`options`/`columns` — a violation is 422);
  appends a series point for metric/series.
- `POST /api/dashboards/{tenant_id}/actions/{key}` → fire an action,
  writes a `LedgerEvent`, returns it.
- `GET /api/dashboards/{tenant_id}/series/{key}?range=30d|90d|1y` →
  points for a chart.

Tests: set a metric twice → delta and series reflect both; cross-tenant
read/write rejected; binding-violating value is 422; fresh-DB
create-all/migrations cover the new tables.

## II-3. Widgets become real instruments (frontend)

`BlueprintRenderer` fetches `GET /api/dashboards/{tenant_id}/data` once
(via shared `apiFetch`), passes each widget its resolved data + binding.
Every widget gets **loading skeleton / empty ("No data yet — add your
first entry") / populated** states. **Never a fake number in the empty
state.**

- **`MetricCard`** — shows the stored value; delta from the last two real
  `WidgetSeriesPoint`s; sparkline from the real series. Inline "＋ update"
  opens a field (`input` type from the binding), `PUT`s, optimistic
  update. Count-up stays, over the real number.
- **`DataTable`** — add row / edit cell / delete row, each persisted to
  the `table` value. Columns from `data_binding.columns`. Inline
  validation. Keep status-cell colour, driven by the binding not
  string-sniffing.
- **`LedgerToggle`** — fires `POST .../actions/{key}`, shows the last
  `LedgerEvent` ("Season closed 12 Aug by you"). **Delete the "for demo
  purposes" local state.**
- **`ChartWidget`** — plots the real series from `.../series/{key}` with a
  30d/90d/1y toggle. Empty until ≥2 points.
- **`StatusBadge`** — user sets it from `data_binding.options`; persists;
  colour maps from the option.
- **`ListWidget`** — real add/edit/remove, persisted.

All through the shared `apiFetch` (401 handling already global). No
component hand-rolls fetch.

## II-4. The interview produces the catalog (bridges to Part I)

- Each `InterviewTurn` contributes `catalog_additions: list[DataBinding]`,
  accumulated on the session alongside `collected_data` + `coverage`.
- The mutation prompt builds each `Widget` from a catalog entry: pick the
  right component for the `kind` (`metric`→MetricCard, `series`→
  ChartWidget, `table`→DataTable, `status`→StatusBadge, `list`→ListWidget,
  `action`→LedgerToggle), set `data_binding` to the catalog entry, set
  `props` to presentation only. **No literal data values, ever.**
- `backend/scripts/seed_archetypes.py` base templates become **binding
  catalogs** per archetype (starting `DataBinding`s — keys, kinds, units,
  inputs), not fake sample rows. Mutation adds/removes/specialises from
  that start.
- Outcome: `factory_owner` for a tile plant → `kiln_temperature_c`
  (metric), `firing_batches` (table), `raw_clay_stock_tonnes` (metric),
  `glaze_line_status` (status); for a dairy → `cold_storage_temp_c`,
  `milk_intake_litres_daily`, `pasteurisation_batches`, `chiller_status`.
  Same archetype, genuinely different instrument.

## II-5. Editable and revisable

- **Per-widget:** rename, hide/remove, add-from-catalog, reorder. (Full
  drag-resize out of scope; add/remove/retitle/reorder in.)
- **"Refine dashboard":** re-enter the interview with existing
  `collected_data` + catalog + coverage prefilled, regenerate — and
  **migrate widget data by `key`**: any surviving `key` keeps its
  `WidgetValue`/`WidgetSeriesPoint` history. New keys start empty; dropped
  keys' data is retained-but-hidden (recoverable), not deleted. Same
  `generate_structured_output` + schema-validation path. Gate behind a
  confirmation (changes the live dashboard).

---

# PART III — The visual system: iconic

*After Parts I & II, and without regressing them. Beauty that breaks a
working flow is a regression.*

## III-1. The bar

"An operating system for an empire, rendered as an instrument." Every
surface has depth; nothing is a flat rectangle. Light moves. Alive at
rest, choreographed in motion. Reference: Apple "neural engine" keynote
renders, Arc/Linear/Vercel depth, MRI/tractography glow. Five mandatory
ingredients: a volumetric 3D centerpiece; layered morphism; ambient life;
choreographed motion; micro-interaction craft.

## III-2. The 3D centerpiece (`3d.json` + post-processing)

- **Scene asset:** add `frontend/src/assets/seal.scene.json` —
  `THREE.ObjectLoader` format. Recommended: keep your procedural geometry,
  build the scene once, `scene.toJSON()`, commit the result; the
  component *loads* it instead of rebuilding each mount. Or hand-author/
  export a richer seal (CC0/CC-BY or self-authored, credited in
  `frontend/CREDITS.md`, **< 1.5 MB**, geometry-only — textures generated
  on a canvas at runtime).
- **The seal, upgraded:** two hemispherical gold lattice shells (not flat
  tori), a faceted refracting core gem, a 200–400-point additive orbiting
  field, a faint volumetric halo. Still reads as "seal / signet / imperial
  mark" at a glance.
- **Post-processing** (`three/examples/jsm/postprocessing`): `RenderPass →
  UnrealBloomPass` (strength ≈ 0.8, radius ≈ 0.5, threshold ≈ 0) `→` a
  small `ShaderPass` for grain + vignette + ~0.5px chromatic aberration
  `→ OutputPass`. `ACESFilmicToneMapping`, exposure ≈ 1.15,
  `SRGBColorSpace`, a `RoomEnvironment` + `PMREMGenerator` env map so gold
  reads as metal.
- **Scale & moment:** `large` renders at a genuinely large canvas (min
  320×320, responsive to ~480) and anchors: the auth loading screen, the
  vault transition, the onboarding "thinking / compiling blueprint"
  state. `state` prop drives intensity — `static` = slow bounded drift +
  resting shimmer; `generating` = visibly working (faster spin, bloom
  pulse, core strobe, agitated particles); `unlocking` = a distinct
  one-shot release (shells split, core flares, particles burst) synced to
  the vault doors.
- `small`/`micro` stay CSS rings — a composer for a 24px avatar is waste
  and a perf risk. Keep that split.
- **Discipline (keep what's there):** `try/catch` + `webglcontextlost` →
  `onError` → CSS fallback that still reads as the seal;
  `prefers-reduced-motion` → one static frame, no RAF; full teardown on
  unmount (every geometry, material, texture, render target, **composer
  pass**, RAF, listener). **Deliver a DevTools memory-timeline screenshot
  across 10 mount/unmount cycles showing flat heap.**

## III-3. Layered morphism — every surface

- **Glass as the base language, everywhere:** route `AuthScreen`,
  `OnboardingChat`, the hero card, `SettingsModal`, `ProjectNameModal`,
  every dropdown through `tokens.css` glass (`--glass-surface-*` +
  `--blur-*` + `--glass-border-*` + `--shadow-elevation-*`). No flat
  `background: #0a1628` rectangle survives. Migrate `AuthScreen.jsx` off
  inline styles. **AA contrast** for body text against the busiest
  backdrop (theme photo at full opacity behind full blur) — verify per
  archetype theme.
- **Neumorphic primary actions:** wire the existing
  `--neumorph-primary-raised/hover/pressed` into every primary button
  (Sign In, Create Account, Create Session, Upload, Launch DIWAAN, Save
  Changes, MetricCard update, DataTable add-row). Primary only; secondary/
  ghost stay glass.
- **One accent morphism** (aurora-glass sheen, or claymorphism on one
  hero element) used sparingly for emphasis moments (generated-dashboard
  reveal, HIGH-severity SpecShield mismatch banner, decision card).
  Document which and where.

## III-4. Ambient life (all disabled under `prefers-reduced-motion`)

- **Gradient-mesh / aurora background** behind (or replacing) the
  placeholder photos: 3–4 large blurred radial blobs in the active
  archetype's palette (`themes/archetypes.js`), drifting on a ~30–40s
  loop, GPU-cheap (CSS `filter: blur()` on divs, or one full-screen
  fragment shader). Photo, if kept, sits low-opacity above.
- **Particle drift** — ~40 slow motes over the app, theme-tinted, subtle
  pointer parallax.
- **Cursor spotlight** — soft radial glow following the pointer at low
  opacity on the hero and SpecShield workspace. Off on touch.
- **Resting shimmer** — dormant stat tiles, the seal, idle cards breathe
  (opacity + ≤3% scale, per-element phase).

## III-5. Choreographed motion

- **Vault transition (`App.jsx`):** doors + seal `unlocking` one-shot +
  crossfade = one timed sequence (~800ms, `--ease-vault`), seal as
  centerpiece.
- **Blueprint-compiling state:** `generating` seal at `large`, progress
  shimmer, then a staggered dashboard reveal (each card fades+rises,
  ~60ms stagger) with the accent morphism on the first card.
- **View changes** (auth → specshield → diwaan and back): consistent
  directional slide+fade.
- **Scroll-reveal + parallax** on the hero.
- CSS transitions / Web Animations API only. **No `framer-motion` near
  routing** (it has hung navigation on this React version). One tiny
  stagger helper is fine; no heavy timeline library.

## III-6. Micro-interaction craft + the live bug

- **Magnetic buttons** — primary buttons nudge ~4px toward the pointer on
  near-hover, spring back (off on touch / reduced-motion).
- **Card hover tilt** — SpecShield panels, sample cards, decision card
  tilt ≤6° toward the pointer (perspective ~800px).
- **Animated focus** — `:focus-visible` ring scales 1.5→1 over 120ms.
  Keyboard focus must be *more* visible after this pass.
- **Count-up numbers** — SpecShield AUDIT SUMMARY tiles count from 0 on
  change. **Real values only** (from `documents`/`comparisons`).
- **Shimmer skeletons** replace every bare "loading…" text (dashboard
  fetch, session list, task polling, widget data).
- **Send-answer feedback** — press ripple + bubble rises in.
- **THE BUG:** `frontend/src/components/OnboardingChat.jsx` — a new
  message calls `messagesEndRef.current?.scrollIntoView(...)` which
  scrolls the **page**, dragging the chat's dark panel over the hero
  header (a black band across the top until the user scrolls back).
  **Fix:** the chat history is its own scroll container (`overflow-y:
  auto` + bounded `max-height`); auto-scroll sets *that element's*
  `scrollTop`, never `scrollIntoView` on the page. Test: send an answer,
  assert the hero title is still in view.

---

# HARD — constraints binding on all three parts

- **Do not regress the five prior fix passes** (listed in §0 "Already
  right"). Existing `pytest` and `npm test` (Vitest) suites stay **fully
  green** — extend them, never weaken assertions to pass.
- **The 6-component vocabulary stays closed.** New capability lives in
  `data_binding` + the data layer, not new component names. The
  registry-parity test stays green.
- **Everything the LLM emits is schema-validated** — `DataKind`,
  `DataBinding.input`, `StatusBadge` options, `coverage` values, the
  no-literal-data rule — all Pydantic Literals/validators. A violation
  triggers the existing **validate-then-retry-once**; never bypass that
  contract.
- **No fabricated data reaches the user — anywhere.** A bound widget with
  no `WidgetValue` shows its empty state. Deltas/sparklines only with ≥2
  real points. Animated numbers only over real values. An unanswered
  interview question → `partial`/`n/a`, never an invented fact.
- **Tenant isolation absolute** — every new read/write/series/action
  endpoint and every query filters by `current_user.tenant_id`. No
  cross-tenant access, ever.
- **No new dependencies.** `three` + its bundled `examples/jsm` addons
  only (no `@react-three/*`, no `postprocessing` npm package, no
  `framer-motion`, no GSAP, no CDN scripts). CSS / Web Animations API for
  motion.
- **Performance floor:** 60 fps sustained with the heaviest screen open
  (hero: gradient mesh + particles + `large` seal + composer) under
  Chrome DevTools **4× CPU throttle** — measure and paste. Any single
  effect that can't hold the budget is cut, not shipped degraded.
- **Every WebGL/canvas surface** has: a non-WebGL fallback, full disposal
  on unmount, `prefers-reduced-motion` respect, `webglcontextlost`
  handling.
- **No functional path blocked by more than one frame by any effect** —
  login, register, send-answer, upload, create-session, launch,
  settings-save, sign-out, session-switch, widget update. The vault
  transition's ~800ms is the single allowed exception (already there).
- **Carryover functional debt fixed:** `GEMINI_MODEL` off the dead
  `gemini-1.5-flash` + `services/llm.py` fails loudly on a 404-model;
  `render.yaml` CORS off `"*"`.
- Any asset added: self-authored or CC0/CC-BY, credited in
  `frontend/CREDITS.md`, < 1.5 MB.

---

# ACCEPTANCE CHECKLIST

## Part I — Interview
- [ ] `InterviewTurn` carries `coverage` + `coverage_notes`, persisted.
- [ ] System prompt encodes the §I-1 dimensions, archetype layers, and
      sub-vertical question generation.
- [ ] Questioning branches — irrelevant dimensions marked `n/a` with a
      logged reason, not asked.
- [ ] Owner's bottleneck always explicitly asked and drilled.
- [ ] Gap-check reflect-back turn before `ready_to_generate` (budget
      permitting).
- [ ] `ready_to_generate` gated on §I-3 coverage criteria; 15→18 cap is a
      hard stop that still yields a valid blueprint, flags `truncated`,
      logs uncovered core dimensions.
- [ ] The 5 interview-simulation tests pass, asserting on coverage maps +
      catalog composition.

## Part II — Dashboard
- [ ] `Widget.data_binding` (validated `DataBinding`) exists; a blueprint
      with a literal `value`/`rows` in `props` is rejected and retried.
- [ ] `WidgetValue`, `WidgetSeriesPoint`, `LedgerEvent` models exist,
      registered, using shared column types; fresh-DB create-all/migrations
      cover them.
- [ ] `GET/PUT .../data`, `POST .../actions/{key}`, `GET .../series/{key}`
      — tenant-scoped, validated, tested (cross-tenant rejection +
      binding-violation 422).
- [ ] Every widget renders loading / empty / populated; never a fake
      number when empty.
- [ ] `MetricCard` update persists + appends a series point; delta +
      sparkline from real points.
- [ ] `DataTable` / `ListWidget` / `StatusBadge` edits persist.
- [ ] `LedgerToggle` fires a real `LedgerEvent` and shows it; the "for
      demo purposes" local state is gone.
- [ ] `ChartWidget` plots a real stored series with a range toggle.
- [ ] Two different `factory_owner` businesses produce demonstrably
      different widgets/keys.
- [ ] `seed_archetypes.py` templates are binding catalogs, not fake rows.
- [ ] "Refine dashboard" regenerates and migrates widget data by `key` —
      a value entered before refine survives if its key survives.
- [ ] Add / remove / retitle / reorder widgets post-generation persists.

## Part III — Visual
- [ ] `seal.scene.json` exists (ObjectLoader format); the seal loads it,
      doesn't rebuild geometry each mount; source/licence documented.
- [ ] `EffectComposer` bloom + grain/vignette/CA + ACES + env map; seal
      reads as a volumetric centerpiece at `large`.
- [ ] `static`/`generating`/`unlocking` visually distinct; `unlocking` is
      a real one-shot synced to the vault doors.
- [ ] WebGL-fail and context-loss both fall back to a CSS seal that still
      reads as the mark; reduced-motion renders it static.
- [ ] Flat-heap memory timeline across 10 seal mount/unmount cycles.
- [ ] `AuthScreen`, `OnboardingChat`, hero card, both modals all use
      token glass — no flat dark rectangles. AA contrast per theme.
- [ ] Neumorphic on every primary action, glass on secondaries, one
      documented accent morphism.
- [ ] Gradient mesh + particle drift + cursor spotlight + resting shimmer,
      all reduced-motion-safe, all within the 4× CPU 60fps budget.
- [ ] Vault transition + blueprint-compiling are choreographed sequences
      with staggered widget reveal; view changes slide+fade.
- [ ] Magnetic buttons, card hover-tilt, animated focus-in, count-up on
      real SpecShield stats, shimmer skeletons everywhere "loading…" was.
- [ ] OnboardingChat scrolls inside its own container; a new message never
      pushes the panel over the hero header.

## Cross-cutting
- [ ] `GEMINI_MODEL` default updated; `services/llm.py` fails loudly on a
      404-model. `render.yaml` CORS tightened.
- [ ] Existing `pytest` + `npm test` suites fully green.

---

# DELIVERY NOTES (paste all of this)

1. Transcripts of the 5 simulated interviews with final coverage maps +
   generated `DataBinding` catalogs.
2. A full walk of one real business: interview → generated dashboard →
   entering data into 3+ widgets → a delta/sparkline appearing from real
   consecutive entries → "refine dashboard" → confirming entered data
   survived.
3. The 4× CPU-throttle fps measurement on the heaviest screen.
4. The seal DevTools memory timeline across 10 mount/unmount cycles.
5. Before/after screenshots of every screen touched (auth, onboarding
   chat, generated dashboard, SpecShield, settings, vault transition).
6. Which `core` interview dimensions (if any) the truncation path leaves
   `uncovered`, and the accent-morphism choice + where it's used.
