# Diwaan — the generated dashboard, made a real instrument
## The priority pass. Pairs with `Diwaan_IconicUI_Maximal...` (that one is looks; this one is the point of the product).

**Written:** 2026-09-08
**For:** implementer (Antigravity or equivalent)
**Goal:** Right now the "Formless Intelligence" pillar produces the *shape*
of a dashboard but not a working one. The AI classifies the business,
arranges widgets, and fills them with **fake numbers** — hardcoded sample
rows from the seed templates, or `{{placeholder}}` strings that never
resolve. Nothing the user sees is their data, nothing updates, nothing
persists, and half the widgets do literally nothing when clicked. This
pass makes the generated dashboard a real instrument: every widget bound
to real per-tenant data the user maintains over time, the onboarding
interview gathering exactly what those widgets need, and the whole thing
editable and revisable — while keeping the closed-vocabulary,
schema-validated, no-fabricated-data guardrails the product is built on.

---

## 0. Current state — verified by reading the code, read before touching anything

**The render path is one-shot and static.**
`frontend/src/BlueprintRenderer.jsx` maps `blueprint.active_widgets[].props`
straight into the 6 registry components. Whatever the LLM wrote into
`props` is what renders — forever. There is no data layer.

**The widgets are mockups, not instruments:**
| Widget | File | What it actually does |
|---|---|---|
| `MetricCard` | `components/MetricCard.jsx` | Takes a `value` **string**, count-up animates it. No source, no update, no real history — `sparklineData` is a static array the LLM emitted. |
| `DataTable` | `components/DataTable.jsx` | Renders a fixed `rows` array. Not editable. No add/edit/delete. Comment: *"Hacky formatting for status tags"*. |
| `LedgerToggle` | `components/LedgerToggle.jsx` | Comment: *"For demo purposes, we manage local state if onToggle isn't fully wired to a backend."* Toggles a local boolean that does nothing and doesn't persist. |
| `ChartWidget` / `StatusBadge` / `ListWidget` | `components/*` | Same pattern — static props in, pixels out. |

**The data that should exist, doesn't:**
- `TenantDashboard` persists `active_widgets` (JSON layout) and
  `customized_parameters` (JSON) — but nothing stores *the actual
  business values the user maintains*. `{{acres_under_cultivation}}` is
  never resolved.
- No endpoint updates a widget's value. No per-widget data model. No
  time-series for trends.
- `backend/scripts/seed_archetypes.py` base templates contain fake sample
  data (`"450 kg"`, `"Parcel A"`, `"Wheat"`) that ships straight to the
  user's screen as if it were theirs.

**The onboarding interview gathers prose, not a spec.**
`InterviewTurn.extracted_facts` accumulates loose key/values; the mutation
prompt turns that into widget *titles and fake props*. It never decides
*what operational facts this business tracks and what kind of value each
one is*.

**What's already right and must be preserved:**
- The closed component vocabulary (`backend/schemas/component_registry.py`
  `AllowedComponent` Literal, mirrored in
  `BlueprintRenderer.COMPONENT_REGISTRY`, with a parity test).
- `services/llm.py`'s validate-then-retry-once contract.
- `visual_theme` round-tripping through both dashboard endpoints.
- Tenant isolation on every query.
- The mutation prompt's existing rule: *omit a widget rather than
  fabricate a value*. This pass makes that rule real instead of
  cosmetic.

---

## 1. The core idea: widgets declare a *data binding*, not a value

A generated widget stops carrying literal data. Instead it carries a
**`data_binding`** — a schema-validated declaration of *what fact it
tracks and how the user maintains it*. The renderer resolves that binding
against real stored tenant data at display time.

Add to `backend/schemas/blueprint.py` (Pydantic, validated — no free
strings):

```
DataKind = Literal["metric", "series", "table", "status", "list", "action"]

class DataBinding(BaseModel):
    key: str                      # stable slug, e.g. "monthly_production_sqm"
    kind: DataKind
    label: str
    unit: Optional[str] = None
    input: Literal["number","text","currency","select","date","none"] = "number"
    options: list[str] = []        # for kind=status / input=select
    columns: list[str] = []        # for kind=table
    help: Optional[str] = None     # what to enter, in plain language
```

`Widget` gains `data_binding: Optional[DataBinding]`. Keep `props` for
pure presentation (chart type, number formatting) — never for data.
`key` is unique within a dashboard; it is the identity that survives
regeneration (see §5).

---

## 2. The data layer (backend)

New models in `backend/models/` (register in `backend/models/__init__.py`
— the one that already imports every model — and use `backend/db/types.py`'s
`JSONType`/`UUIDType`, do not redefine them):

- **`WidgetValue`** — current state per binding:
  `(tenant_id, key, value_json, updated_at, updated_by)`, PK
  `(tenant_id, key)`. `value_json` shape depends on `kind`:
  `metric`→number, `status`→one of `options`, `table`→list of row objects,
  `list`→list of item objects, `action`→last-fired event.
- **`WidgetSeriesPoint`** — history for `kind:"metric"|"series"`:
  `(id, tenant_id, key, ts, value)`, indexed on `(tenant_id, key, ts)`.
  Every `metric` write also appends a series point, so deltas and
  sparklines are **real** (previous point vs current), not LLM guesses.
- **`LedgerEvent`** — for `kind:"action"`:
  `(id, tenant_id, key, label, fired_at, fired_by, note)`. A
  `LedgerToggle` firing writes one of these. No local-only boolean.

Endpoints (all tenant-scoped via `current_user.tenant_id`, all through
the existing patterns — routes return through the shared error handling):

- `GET /api/dashboards/{tenant_id}/data` → `{ [key]: { value, updated_at,
  series?: [...], history_range } }` for every binding on the tenant's
  dashboard. Unknown/never-set keys simply absent.
- `PUT /api/dashboards/{tenant_id}/data/{key}` → set a value (validated
  against the binding's `kind`/`options`/`columns`); appends a series
  point for metric/series kinds.
- `POST /api/dashboards/{tenant_id}/actions/{key}` → fire an action,
  writes a `LedgerEvent`, returns it.
- `GET /api/dashboards/{tenant_id}/series/{key}?range=30d|90d|1y` →
  points for a chart.

Add tests: set a metric twice → delta and series reflect both writes;
cross-tenant read/write is rejected; a value violating its binding
(`status` not in `options`, `table` row missing a column) is a 422.

---

## 3. The widgets become real instruments (frontend)

`BlueprintRenderer` fetches `GET /api/dashboards/{tenant_id}/data` once
(via the shared `apiFetch`), passes each widget its resolved data +
binding. Every widget gets three states: **loading skeleton**, **empty
("No data yet — add your first entry")**, **populated**. Never a fake
number in the empty state.

- **`MetricCard`** — shows the stored value; delta computed from the last
  two `WidgetSeriesPoint`s (real); sparkline from the real series. An
  inline "＋ update" control opens a small field (`input` type from the
  binding) that `PUT`s the new value and optimistically updates. Count-up
  animation stays, but over the real number.
- **`DataTable`** — editable: add row / edit cell / delete row, each
  persisted to the `table` value. Columns come from `data_binding.columns`.
  Inline validation. Keep the status-cell colouring but drive it off the
  binding, not string-sniffing.
- **`LedgerToggle`** — fires a real `POST .../actions/{key}`, shows the
  last `LedgerEvent` ("Season closed 12 Aug by you"), disables re-fire
  where that makes sense. **Delete the "for demo purposes" local state.**
- **`ChartWidget`** — plots the real series from `.../series/{key}` with a
  range toggle (30d / 90d / 1y). Empty until there are ≥2 points.
- **`StatusBadge`** — the user sets it from `data_binding.options`; the
  choice persists; the badge colour maps from the option.
- **`ListWidget`** — real add/edit/remove of items, persisted.

Wire these through the shared `apiFetch` (401 handling is already global).
No component hand-rolls its own fetch.

---

## 4. The interview now produces a metric catalog

The onboarding interview's job expands from "classify + arrange" to
"**figure out the 6–12 operational facts this specific business tracks,
and for each: what kind of value, what unit, how it's entered.**"

- `InterviewTurn` gains `catalog_additions: list[DataBinding]` — each
  answer can contribute one or more bindings, accumulated onto the
  session (alongside the existing `collected_data`).
- The system prompt in `backend/api/onboarding.py` is rewritten to drive
  toward this: ask questions that surface *trackable operational facts*
  ("Do you track kiln temperature per firing?" "How do you record raw
  material stock — a running total, or per delivery?"), not flavour.
- The mutation prompt then builds each `Widget` from a catalog entry:
  choose the right one of the 6 components for the binding's `kind`
  (`metric`→MetricCard, `series`→ChartWidget, `table`→DataTable,
  `status`→StatusBadge, `list`→ListWidget, `action`→LedgerToggle),
  set `data_binding` to the catalog entry, set `props` to presentation
  only. **No literal data values in the output, ever** — enforce this in
  the schema (reject a `MetricCard` whose `props` contains a `value`).
- Result: `archetype="factory_owner"` for a tile plant produces
  `kiln_temperature_c` (metric), `firing_batches` (table),
  `raw_clay_stock_tonnes` (metric), `glaze_line_status` (status); for a
  dairy it produces `cold_storage_temp_c`, `milk_intake_litres_daily`,
  `pasteurisation_batches`, `chiller_status`. Same archetype, genuinely
  different instrument — which is the pillar-3 promise, finally real.

`backend/scripts/seed_archetypes.py` base templates become **binding
templates** (a starting catalog of `DataBinding`s per archetype —
declaring keys, kinds, units, inputs), not fake sample rows. The mutation
adds, removes, and specialises from that starting catalog.

---

## 5. The dashboard is editable and revisable

- **Per-widget edit:** rename, hide/remove, and "add a widget" from the
  tenant's catalog (or a small library of standard bindings for the
  archetype). Full drag-resize is out of scope; add / remove / retitle /
  reorder is in.
- **"Refine dashboard":** re-enter the interview with the existing
  `collected_data` **and** existing catalog prefilled, regenerate the
  blueprint — and **migrate widget data by `key`**: any binding whose
  `key` survives regeneration keeps its `WidgetValue` /
  `WidgetSeriesPoint` history. The user never loses numbers they've
  entered because the AI reworded a title. New keys start empty; dropped
  keys' data is retained but hidden (recoverable), not deleted.
- This flow goes through the same `generate_structured_output` +
  schema-validation path as first-time onboarding — no shortcut.
- Gate it behind a confirmation (it changes the tenant's live dashboard).

---

## 6. Hard constraints (violating any fails the pass)

- **The 6-component vocabulary stays closed.** New capability lives in
  `data_binding` + the data layer, not new component names. The
  registry-parity test stays green.
- **Everything the LLM emits is schema-validated.** `DataKind`,
  `DataBinding.input`, `StatusBadge` options — all Pydantic Literals /
  validators. A blueprint with a literal data value in a widget's `props`
  is **rejected**, triggering the existing retry-once.
- **No fabricated data reaches the user.** A bound widget with no
  `WidgetValue` shows its empty state. Deltas/sparklines render only with
  ≥2 real series points. This is the philosophy's own rule — enforce it
  in code now, not just in a prompt string.
- **Tenant isolation absolute** — every new read/write/series/action
  endpoint filters by `current_user.tenant_id`.
- **Don't regress the five prior fix passes** — JWT base64url decode,
  `pending_session_id` surviving a 401 (incl. during the resume-check
  GET), `visual_theme` round-trip through both dashboard endpoints,
  SpecShield poll-timer cleanup + overlap guard + debounce, the shared
  `apiFetch`/`decodeJwtPayload`/`clearSession` module used by every
  component, `backend/db/types.py` as the single column-type source,
  `backend/models/__init__.py` importing every model. Existing `pytest`
  and `npm test` suites stay fully green.
- **`services/llm.py`'s retry-once contract is never bypassed.**
- No new dependencies.

---

## 7. Acceptance checklist

- [ ] `Widget.data_binding` (validated `DataBinding`) exists; a blueprint
      with a literal `value`/`rows` in `props` is rejected and retried.
- [ ] `WidgetValue`, `WidgetSeriesPoint`, `LedgerEvent` models exist,
      registered, using shared column types; migrations/create-all cover
      them (verified against a fresh DB).
- [ ] `GET/PUT /api/dashboards/{tenant_id}/data`,
      `POST .../actions/{key}`, `GET .../series/{key}` — all tenant-scoped,
      all validated, all tested (incl. cross-tenant rejection and
      binding-violation 422).
- [ ] Every widget renders loading / empty / populated states and never
      shows a fake number when empty.
- [ ] `MetricCard` update control persists and appends a series point;
      delta + sparkline computed from real points.
- [ ] `DataTable` add/edit/delete rows persist. `ListWidget` items
      persist. `StatusBadge` selection persists.
- [ ] `LedgerToggle` fires a real `LedgerEvent` and shows it; the
      "for demo purposes" local state is gone.
- [ ] `ChartWidget` plots a real stored series with a range toggle.
- [ ] The interview accumulates a `DataBinding` catalog; two different
      `factory_owner` businesses (e.g. tile plant vs dairy) produce
      demonstrably different widgets/keys from the same archetype.
- [ ] `seed_archetypes.py` templates are binding catalogs, not fake rows.
- [ ] "Refine dashboard" regenerates and migrates existing widget data by
      `key` — a value entered before refine is still there after, if its
      key survives.
- [ ] Add / remove / retitle / reorder widgets post-generation works and
      persists.
- [ ] `pytest` + `npm test` fully green; delivery notes show a walk of
      one business from interview → generated dashboard → entering data →
      delta/sparkline appearing → refine → data retained.
