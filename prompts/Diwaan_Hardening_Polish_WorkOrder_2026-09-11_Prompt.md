# Diwaan — Hardening & Polish Work Order
## Five independent, scoped fixes. No shared dependencies — do them in any order, each is its own commit-sized unit.

**Written:** 2026-09-11
**For:** implementer (Antigravity or equivalent)
**Depends on:** the Multi-Business Work Order (2026-09-11) already landed and reviewed —
`TenantDashboard.id`, `GET/POST/DELETE /api/dashboards`, `BusinessSwitcher`, and the
`0001_multi_business_dashboards` migration all exist and are green (26/26 backend
tests, 13/13 frontend tests). Don't re-touch that surface except where a section
below names it explicitly.

**Before starting anything:** run the app and actually look at it —
`backend/venv/Scripts/python -m uvicorn backend.main:app --reload` from the repo
root, `npm run dev --prefix frontend`. Every item below was found by running the
real app, not by reading code. Verify the same way when you're done.

---

## 1. Fix the scroll black-gap on the dashboard view

**Symptom:** on the generated-dashboard view (`activeBlueprint` set in
`LandingPage.jsx`), scrolling down reveals a solid black band above the widget
grid instead of the themed background continuing. Reproduced by loading a
dashboard and scrolling ~300px down.

**Where to look first:**
- `frontend/src/LandingPage.jsx`'s "Background System" div — it's
  `position: fixed; inset: 0` (viewport-locked), so it never extends past the
  first viewport height. `.page` in `LandingPage.css` has its own
  `background: var(--vault-sapphire)`, which should show through once the
  fixed layer's viewport bounds are scrolled past — check whether something
  (a wrapper without a background, a stacking/paint order issue, or the
  fixed layer's own scrim/gradient) is instead showing default black.
- Also check `App.jsx`'s outer wrapper (`<div style={{ minHeight: '100vh',
  position: 'relative', overflow: 'hidden' }}>`) — `overflow: hidden` here
  with content taller than 100vh can clip in surprising ways depending on
  how the scroll container is established.
- Note `.nav` was recently bumped to `z-index: 50` (2026-09-11, to fix the
  BusinessSwitcher dropdown hit-testing bug) while `.dashboard-section` is
  still `z-index: 10` — confirm this didn't shift what paints where during
  scroll.

**Fix it, then verify** by loading a real generated dashboard (6+ widgets so
there's genuine scroll height) and scrolling the full page — no black band,
themed background/motes continue or fade gracefully the whole way down, in
both light content areas and near the bottom.

---

## 2. Replace the props denylist with a real per-component allowlist

**Current state (`backend/schemas/blueprint.py`):** `_FORBIDDEN_PROPS_KEYS` is
a ~15-entry denylist of keys that "carry fabricated content" (`value`, `rows`,
`items`, `data`, `status`, `text`, `amount`, …), checked at generation time and
stripped at read time via `sanitize_stored_widgets`. This is defensive but
loose — it only catches keys someone thought to list, and a new fake-data key
the model invents (`total_revenue`, `latestReading`, anything not on the list)
sails through untouched.

**Do instead:** for each of the 6 `AllowedComponent`s, define the actual set of
legitimate *presentation-only* prop keys (e.g. `MetricCard` might legitimately
take `chartType`, `unit`, `precision`, `icon`, `colorScheme` — never `value`;
`ChartWidget` might take `chartType`, `color`, `showLegend` — never `data` or
`points`). Validate `Widget.props` against the allowlist for `widget.component_name`
specifically, not one global set. Reject (trigger the existing
`generate_structured_output` retry-with-error path) any prop key not on that
component's allowlist.

Keep `sanitize_stored_widgets` for the read path (old dashboards persisted
under the looser rule must still open), but have it strip against the new
per-component allowlists too.

**Tests:** for at least 2 components, one test asserting a legitimate prop
passes and one asserting a disallowed key (old forbidden-list style, e.g.
`props={"value": "1M"}`) is rejected/stripped. Full backend suite stays green.

---

## 3. Verify the multi-business migration against real Postgres

**Current state:** `backend/alembic/versions/0001_multi_business_dashboards.py`
has an `_upgrade_postgres()` branch written by reasoning through the SQL, but
it has **never been run against an actual Postgres instance** — there wasn't
one available in the environment that wrote it. It might have syntax or
ordering bugs the SQLite path (which *was* verified, upgrade → downgrade →
upgrade, against real data) doesn't have.

**Do:**
- Add a `docker-compose.yml` (or extend one if it exists) with a throwaway
  Postgres service for local verification — doesn't need to ship to prod,
  just needs to exist for this check and for future migrations.
- Run `alembic upgrade head` against it starting from a schema created by
  `Base.metadata.create_all` (simulating a fresh Postgres deploy) — confirm
  it completes without error and the resulting schema matches what the ORM
  models expect (spot-check: `tenant_dashboards.id` is a native `uuid` column
  with a PK, `widget_values` PK is `(dashboard_id, key)`, all 3 data tables
  have `dashboard_id` FKs with `ON DELETE CASCADE`).
- Also seed a tenant with one pre-migration-shaped dashboard (`tenant_id` as
  the only key, no `id`/`name`) directly via SQL, run the upgrade, and confirm
  it backfills correctly on Postgres the same way it does on SQLite.
- Write down what you did as a short section in `CONTEXT.md` (or a new
  `backend/alembic/README.md`) so the next migration author knows there's a
  real way to test against Postgres locally, and doesn't have to guess like
  this one did.

If a real Postgres genuinely isn't reachable in your environment either, say
so explicitly in your summary rather than leaving `_upgrade_postgres()`
silently unverified a second time.

---

## 4. Visual polish audit — close the gaps, don't rebuild

**Current state:** the signature visual system (2026-09-05/08 passes) is
already substantial and should NOT be redone — `frontend/src/styles/tokens.css`
and `glass.css` define real glassmorphism (`glass-card-base`, `glass-modal`),
neumorphism (`neumorph-primary`), blur/shadow/elevation tokens; widgets already
use `glass-card component-wrapper`, count-up animations, reveal-on-mount
keyframes; `ThreeDiwaanSeal.jsx` is a working procedurally-generated Three.js
seal with bloom post-processing (RoomEnvironment, EffectComposer,
UnrealBloomPass — all wired since the 2026-09-11 blocker-fix pass); the
background system has theme images, an aurora gradient mesh, and 40 ambient
particle motes.

**This item is an audit, not a greenfield pass.** Load each of the 5 sample
dashboards (View Sample Dashboards on the landing page) and a real generated
one, and specifically look for:
- Any widget or surface that's still a bare unstyled `<div>` — falling back to
  browser defaults instead of `glass-card`/`neumorph-primary`.
- Places where an effect is defined in CSS but never applied (dead classes) —
  or applied but invisible because of a missing token/variable.
- Micro-interactions that are all-or-nothing (hover states, button press
  feedback) — anywhere a click/hover has zero visual response.
- The empty-state and loading-state visuals (chart "add data points", table
  "no entries yet") — are they styled consistently with the rest of the
  system, or do they look like an afterthought?

Fix what you find. Don't add a new visual language — extend the existing
tokens. If you genuinely find nothing worth fixing after a careful look, say
so in your summary rather than inventing busywork.

---

## 5. Migrate off `google.generativeai` (deprecated, end-of-life)

**Current state (`backend/services/llm.py`):** imports `google.generativeai as
genai`. Every backend boot logs:

```
FutureWarning: All support for the `google.generativeai` package has ended.
It will no longer be receiving updates or bug fixes. Please switch to the
`google.genai` package as soon as possible.
```

This is the whole product's LLM choke point — if this package breaks (a
Python version bump, a security issue with no fix coming), the entire
interview → blueprint pipeline stops working with no warning.

**Do:** migrate `backend/services/llm.py` to the `google-genai` package
(`pip install google-genai`, `from google import genai`). The public surface
you need to preserve exactly: `generate_structured_output(prompt, schema,
file_uri=None)` — forces JSON output, parses into the given Pydantic schema,
retries once with the validation error fed back on failure, and the
`_is_model_not_found(e)` exception-classification added in the 2026-09-11
blocker-fix pass (checks `google.api_core.exceptions.NotFound` and message
substrings for "not found"/"is not supported"). The new SDK's exception types
differ — find the equivalent and update that check, don't just leave it
silently never matching.

Update `backend/requirements.txt` (drop `google-generativeai`, add
`google-genai`). Re-run the full backend suite — every test that mocks
`generate_structured_output` should be unaffected since the public function
signature doesn't change; tests that touch the LLM client internals directly
(if any) need updating.

**Verify with a real call**, not just mocked tests: run one actual onboarding
interview turn against the live Gemini API (or the mock flow if the daily
quota is exhausted — check first) and confirm a real `InterviewTurn`/`Blueprint`
comes back correctly shaped.

---

## Definition of done

- All 5 sections above complete, each independently verified by running the
  app (not just reading the diff).
- Full backend suite green, `npm run build` and `npm test` green on frontend.
- No new `FutureWarning`/`DeprecationWarning` from `google.generativeai` in
  backend startup logs.
- A screenshot or short description in your summary showing the black-gap fix
  (scrolled dashboard, no black band) and the props-allowlist rejection
  working (a deliberately-bad blueprint attempt getting caught).
