# Diwaan — bring it to reality
## From a two-sided demo shell to one working, authenticated, AI-driven product

**Written:** 2026-09-04
**For:** implementer (Antigravity or equivalent agentic coding tool)
**Goal:** Diwaan already has a real, schema-guarded AI backend and a good-looking
frontend. They are not actually connected. This prompt closes that gap —
end to end, one authenticated tenant, real data only, no more fixtures
standing in for the product.

---

## 0. The philosophy, in one paragraph (read this, then forget the marketing language and build)

Diwaan is a chief-administrative-minister-for-your-business: one command
center (**Authority**) that starts from a pre-built, sector-specific
baseline — Farmer / Shopkeeper / Factory Owner (**Adaptive Foundations**) —
and then an AI onboarding interview mutates that baseline via a
strictly-validated JSON blueprint into something specific to *this*
business (**Formless Intelligence**). Every one of these three pillars
already has real code behind it. The job below is to make that code the
thing a user actually experiences, instead of a fixture sitting next to it.

---

## 1. Current state — read before touching anything

**Stack:** FastAPI + SQLAlchemy (async) + Alembic + Postgres + Redis/Celery
on the backend; React 19 + Vite 8 on the frontend, no router, no HTTP
client library, no state/query library, no test framework at all today.
Gemini (`google-generativeai`) is the only LLM provider, called through one
choke point: `services/llm.py`.

### 1.1 What is real (verified by reading the code, not assumed)

| Capability | File(s) | Behaviour |
|---|---|---|
| Schema-guarded LLM calls | `backend/services/llm.py` | Forces `response_mime_type: application/json`, parses into a Pydantic schema, **retries once with the validation error fed back to the model** on failure, raises a clean `APIError` on a second failure. This is the mechanism that keeps the AI honest — do not bypass it anywhere. |
| Closed component vocabulary | `backend/schemas/component_registry.py` (`AllowedComponent` Literal) mirrored by `frontend/src/BlueprintRenderer.jsx`'s `COMPONENT_REGISTRY` | A widget with an invented `component_name` is rejected by Pydantic before it reaches the DB; on the frontend it falls back to `UnsupportedWidget`. Two hand-synced lists today — see T6. |
| Conversational onboarding | `backend/api/onboarding.py` | Turn-by-turn interview (`InterviewTurn` schema: `ask_question` / `ready_to_generate`, `extracted_facts` merged into `session.collected_data`), capped at 15 questions, then a classify call → an archetype-mutation call → persists to `TenantDashboard`. |
| Archetype baselines | `Archetype` model (`backend/models/diwaan.py`) seeded by `backend/scripts/seed_archetypes.py` | Real DB rows for `farmer` / `shopkeeper` / `factory_owner`, each with a `base_template` JSON the mutation prompt is grounded in. **Currently 2 toy widgets per archetype** — see T4. |
| Auth | `backend/api/auth.py`, `backend/core/security.py` | Real registration (creates a `Tenant` + `User`), real JWT login (`user_id` + `tenant_id` claims, `python-jose`), 30-minute expiry, **no refresh mechanism**. |
| SpecShield document pipeline | `backend/api/specshield.py`, `backend/worker/tasks.py`, `models/specshield.py` | Real multipart upload (25 MB cap, `python-magic` MIME sniff, DWG → `manual_review_required`), dispatched to a Celery task that calls Gemini multimodally (`file_uri`) to extract `{param, label, value}` specs, then `_trigger_comparison_if_ready` diffs a `blueprint`-type doc against an `invoice`-type doc into `ComparisonResult` rows with `LOW`/`MEDIUM`/`HIGH` severity. |
| The onboarding chat *is* wired to the backend | `frontend/src/LandingPage.jsx` lines 30–150 | Not a fixture. On mount it logs in as a hardcoded demo user, then calls `POST /api/onboarding/sessions` and `POST /api/onboarding/sessions/{id}/respond` for real, with visible handling for `401` and `502`. It is simply **defaulted off** — see 1.2. |
| Backend tests exist | `backend/tests/` | `test_auth.py`, `test_onboarding.py`, `test_diwaan.py`, `test_specshield.py`, `test_llm_retries.py`, `test_extraction_real.py`. Run them before and after every task in this prompt; nothing here should reduce green coverage. |

### 1.2 What is fake, disconnected, or broken — the actual gap

1. **Onboarding defaults to a scripted mock.** `frontend/.env` has
   `VITE_ONBOARDING_MOCK=true`. When true, `LandingPage.jsx` calls
   `mockStartSession()` / `mockRespond()` from
   `frontend/src/onboardingMock.js` — four hardcoded questions about "a
   bicycle factory" ending in a hardcoded `FACTORY_OWNER_BLUEPRINT` fixture.
   The real path exists and is fully coded; it has evidently never been
   the default experience.

2. **There is no login/registration UI.** The only credential path is a
   "Temporary Auth Bootstrap" in `LandingPage.jsx` that silently logs in as
   `demo@diwaan.local` using `VITE_DEMO_PASSWORD`, a user that only exists
   because someone ran `scripts/seed_demo_user.py` by hand. Every visitor
   is the same tenant. There is no way, today, for a second real business
   to onboard.

3. **SpecShield has zero backend wiring.** `frontend/src/SpecShield.jsx`
   renders entirely from `SPEC_SHIELD_FIXTURE` (`frontend/src/fixtures.js`)
   plus two hardcoded arrays, `AGENTS` and `LOG_ENTRIES`, with an invented
   `VOLTAGE 480V vs 240V` mismatch baked into the JSX. There is no
   `POST /api/specshield/sessions`, no upload dropzone calling
   `POST /api/specshield/sessions/{id}/documents`, no polling of
   `GET /api/tasks/{task_id}` or `GET /api/specshield/sessions/{id}`
   anywhere in the frontend. **This is the single largest gap in the
   project** — a fully-built async document-audit pipeline with a
   real-looking UI in front of it that has never once been connected.
   `App.jsx` defaults to showing this fixture (`view: 'specshield'`) as
   the very first thing a visitor sees.

4. **A real, verifiable theming bug: live-generated dashboards always get
   the wrong skin.** `frontend/src/themes/archetypes.js` defines 5 visual
   themes with ids `kirana-shop`, `farm`, `paper-factory`,
   `ice-cream-factory`, `tiles-factory`. The backend's `Blueprint.archetype`
   is one of exactly 3 values: `farmer`, `shopkeeper`, `factory_owner`. In
   `LandingPage.jsx` line 389:
   ```js
   const theme = ARCHETYPES.find(t => t.id === activeBlueprint.archetype.replace('_', '-')) || ARCHETYPES[0];
   ```
   `"farmer".replace('_','-')` → `"farmer"` (no theme has that id — the
   farm theme's id is `"farm"`). `"shopkeeper"` → matches nothing (theme id
   is present but check: none of the 5 ids is literally `"shopkeeper"`
   either — closest is `"kirana-shop"`). `"factory_owner".replace('_','-')`
   → `"factory-owner"` (no theme has that id — the three factory-flavoured
   themes are `paper-factory` / `ice-cream-factory` / `tiles-factory`).
   **`.find()` never matches, so every real generated dashboard silently
   falls back to `ARCHETYPES[0]` — the Kirana Shop palette and background
   image — regardless of the business.** The 5-theme "sample dashboards"
   preview mode (`sampleMode`) is unaffected because it keys off
   `sampleTab` directly, which *is* one of the 5 real theme ids — so this
   bug is invisible unless you actually complete a live onboarding.

5. **No sub-vertical concept on the backend at all.** The philosophy
   explicitly promises a factory template turning into "kiln temperatures
   for a tile manufacturer" or "cold-storage metrics for a dairy
   processor" — i.e. a visual/vertical specialization *finer* than the 3
   archetypes. The frontend already has 5 themes ready for exactly this.
   `schemas/blueprint.py`'s `Blueprint` has no field to carry it — the LLM
   is never even asked to pick one.

6. **No frontend test tooling.** `frontend/package.json` has zero test
   dependencies — no Vitest, no React Testing Library, nothing.

7. **`api/diwaan.py` duplicates `api/onboarding.py`'s generation step**
   (`POST /api/onboarding/generate-blueprint`, single-shot from a raw
   description, no interview) but the frontend never calls it. Check
   `test_diwaan.py` before deciding its fate — do not delete a
   tested, working endpoint without understanding why it exists; it may be
   the intended API-only / programmatic-integration entry point. Decide
   and document, don't silently orphan it further.

---

## 2. Tasks

### T1 — Real auth, for real users, not one hardcoded demo tenant
- Build a real login / register screen (email, password, tenant/business
  name) hitting the already-working `POST /api/auth/register` and
  `POST /api/auth/login`. This gates the app — no more silent
  auto-login as `demo@diwaan.local` baked into `LandingPage.jsx`.
- Persist the JWT (a short-lived access token in memory + `sessionStorage`
  is enough; do not build a refresh-token system the backend doesn't have
  — see T7 for the real fix to the 30-minute-expiry problem).
- A logged-out visitor sees the login/register screen, not the onboarding
  chat or SpecShield fixture. A logged-in visitor with no `TenantDashboard`
  yet sees onboarding; one with a completed dashboard sees it directly
  (`GET /api/dashboards/{tenant_id}` already exists for this — use it
  instead of re-running onboarding on every visit).
- The demo user / `seed_demo_user.py` may stay as a dev convenience, but
  it must no longer be the only way into the product.

### T2 — Make the real onboarding the default, not the mock
- Flip `VITE_ONBOARDING_MOCK` to `false` by default in `.env` / deploy
  config. `onboardingMock.js` may stay as an explicit, opt-in dev fixture
  (keep the existing "SCRIPTED PREVIEW" banner behaviour for when someone
  turns it back on locally) — it must never be what a real user sees.
  Sample dashboards should be scoped and re-verified end-to-end against a
  running backend with a real `GEMINI_API_KEY`: start a session, answer
  through to `ready_to_generate`, confirm a `Blueprint` renders. Fix
  whatever breaks — this path has evidently not been exercised for real.

### T3 — Fix the theme-matching bug (finding 4 above)
- Do not just patch the `.replace()` call. The correct fix threads
  through the schema: add a validated field the mutation LLM call
  populates — e.g. `visual_theme: Literal["kirana-shop","farm",
  "paper-factory","ice-cream-factory","tiles-factory", ...]` in
  `schemas/blueprint.py`'s `Blueprint`, single-sourced against the ids in
  `frontend/src/themes/archetypes.js` (mirror them server-side the same
  way `component_registry.py` mirrors `COMPONENT_REGISTRY` — and see T6 for
  making that sync less fragile). Update the mutation prompt in
  `api/onboarding.py` (and `api/diwaan.py` if it stays alive) to instruct
  the model to choose the closest visual theme from the same list, given
  the business facts collected — this is literally pillar 3's "tile
  manufacturer vs dairy processor" promise, made real.
- Make the field optional with a safe default (e.g. fall back to the
  archetype's most generic theme) so existing `TenantDashboard` rows and
  the existing test fixtures don't break.
- `LandingPage.jsx` then looks up the theme by `activeBlueprint.visual_theme`
  directly — no string-mangling `.replace()` guesswork.
- Add a regression test (`test_diwaan.py` or a new file) asserting a
  generated `Blueprint.visual_theme` is always one of the known theme ids,
  and a frontend test asserting a `factory_owner` blueprint never silently
  falls back to the Kirana Shop theme.

### T4 — Flesh out the archetype baselines to match the philosophy
`seed_archetypes.py` today gives each archetype exactly 2 widgets. Rewrite
the three `base_template`s to actually reflect the pillar-2 baselines:
- **Farmer:** land/plot mapping, crop-cycle stage, weather telemetry
  (rainfall/temperature), input costs, harvest yield trend.
- **Shopkeeper:** POS daily sales, fast-moving inventory ledger (low-stock
  alerting), barcode/SKU table, supplier ledger.
- **Factory Owner:** machine runtime/uptime, raw-material supply chain
  status, labor shift roster, production-rate trend, maintenance status.

Every widget must use only the 6 allowed components and real `props` shapes
those components already accept (read `MetricCard.jsx`, `DataTable.jsx`,
`ChartWidget.jsx`, `StatusBadge.jsx`, `LedgerToggle.jsx`, `ListWidget.jsx`
before inventing prop shapes — match what they already render). This is
what the mutation prompt in `onboarding.py` grounds itself in, so a richer
baseline directly produces richer, more specific generated dashboards —
the whole point of the "Adaptive Foundations" pillar.

### T5 — Wire SpecShield to the real pipeline (the big one)
Replace every fixture in `SpecShield.jsx` with real state:
- **Session:** on entering SpecShield, `POST /api/specshield/sessions`
  with a real project name (prompt for it, or derive from the tenant) —
  do not hardcode `SPEC_SHIELD_FIXTURE`.
- **Upload:** a real drop-zone / file-picker for `doc_type` ∈
  `blueprint` / `invoice` / `site-plan`, `POST`ed as multipart to
  `/api/specshield/sessions/{id}/documents`. Surface the `413`
  (>25 MB), `415` (unsupported MIME), and the `manual_review_required`
  DWG case honestly in the UI — these are real, already-implemented
  backend behaviours, don't paper over them.
- **Task polling:** the upload response includes a Celery `task_id`; poll
  `GET /api/tasks/{task_id}` (short interval, bounded retries, visible
  "processing" state) until `SUCCESS`/`FAILURE`, then refetch
  `GET /api/specshield/sessions/{id}` for the updated `documents` +
  `comparisons`.
- **The `AGENTS` sidebar and `LOG_ENTRIES` log bar** must be derived from
  real `documents[].status` / `comparisons[]` state transitions, not
  authored strings. If you want an "agent" framing, derive agent status
  (`active`/`error`/`idle`) from real document/task state — never invent a
  fixed `AGT-03: MISMATCH — VOLTAGE` line again once real comparisons
  exist.
- The comparison grid, alert banner, and severity counts already read
  correctly from `comparisons` — keep that rendering logic, just feed it
  real data from `GET /api/specshield/sessions/{id}` instead of the
  fixture import.
- `App.jsx`'s default `view` and the vault-transition between SpecShield
  and Diwaan can stay as the product's navigation metaphor — just make
  both sides of that door real.

### T6 — Stop hand-syncing the component registry
`schemas/component_registry.py` (backend) and `BlueprintRenderer.jsx`'s
`COMPONENT_REGISTRY` (frontend) must never drift. At minimum, add a test —
backend (`test_diwaan.py` or new) that asserts the `AllowedComponent`
Literal values, and a frontend test asserting `COMPONENT_REGISTRY`'s keys
— stay equal to a single literal list checked in both. Don't over-engineer
a codegen pipeline for a 6-item list; a test that fails loudly on drift is
enough.

### T7 — Fix the 30-minute silent-logout dead end
Today, a `401` mid-onboarding shows "Session expired. Please refresh the
page to log in again" and hard-stops. Given T1 adds real login, this
should become: catch the `401`, redirect to the login screen (preserving
the in-progress onboarding session id so the conversation can resume via
`GET /api/onboarding/sessions/{session_id}` — already implemented on the
backend, just never called by the frontend today), not a dead end.

### T8 — Frontend test tooling
Add Vitest + `@testing-library/react` (`npm i -D vitest
@testing-library/react @testing-library/jest-dom jsdom`) and wire an
`npm test` script. At minimum cover: T1's auth gate, T3's theme-matching
fix, T5's SpecShield state derivation (mock `fetch`), and T6's registry
parity check.

### T9 — Deploy wiring, verified not assumed
- `render.yaml` deploys the API, Celery worker, Postgres, and Redis on
  Render. `frontend/vercel.json` implies Vercel for the frontend. Confirm
  `VITE_API_BASE_URL` in the Vercel deploy env points at the live Render
  API URL, and that `CORS_ORIGINS` on the backend includes the real Vercel
  domain (not just `localhost:5173`/`:3000`).
- `GEMINI_MODEL` defaults to `gemini-1.5-flash` in both `.env.example` and
  `core/config.py`. Verify against the current Gemini API which model ids
  are actually live before shipping — do not assume this string is still
  valid; confirm it, and update both places together if it's changed.
- Run an actual end-to-end smoke pass against the deployed URLs (register
  → onboard → generate → SpecShield upload → comparison) before calling
  this task done, and paste the results in the delivery notes.

---

## 3. Data-provenance table — deliver this, filled, zero "fixture/hardcoded/TBD" rows left in the product surfaces touched above

| Displayed value | Source endpoint / field | Behaviour if unavailable |
|---|---|---|
| Onboarding question | `POST /api/onboarding/sessions` / `.../respond` → `question` | Loading state (`DiwaanSeal generating`), never a scripted line, once T2 lands |
| Generated dashboard widgets | `Blueprint.active_widgets` from the real mutation call | Blueprint absent → "Awaiting blueprint..." (already correct in `BlueprintRenderer.jsx`) |
| Dashboard visual theme | new `Blueprint.visual_theme` (T3) | Falls back to the archetype's default theme, never silently to Kirana Shop |
| SpecShield session / docs / comparisons | `/api/specshield/sessions*`, `/api/tasks/{id}` (T5) | Real `pending` / `processing` / `error` / `manual_review_required` states, never `SPEC_SHIELD_FIXTURE` |
| Agent sidebar status | Derived from real document/task state (T5) | No agent shown as `active` unless a real task is in flight |
| Auth session | Real JWT from `/api/auth/login` (T1) | Logged-out view, not a silent demo-tenant login |

---

## 4. Acceptance checklist

- [ ] A new visitor can register, log in, and land on onboarding — no
      hardcoded `demo@diwaan.local` bootstrap in the shipped path.
- [ ] `VITE_ONBOARDING_MOCK=false` by default; a full live interview →
      classify → mutate → render cycle works against a running backend
      with a real Gemini key, verified by actually running it.
- [ ] A `factory_owner` (and `farmer`, and `shopkeeper`) generated
      dashboard renders with its correct theme — not Kirana Shop by
      default. Regression test in place.
- [ ] Each archetype's `base_template` reflects its pillar-2 baseline
      (concrete widget list per §T4), using only the 6 allowed components
      with prop shapes those components actually accept.
- [ ] SpecShield creates a real session, uploads real files, polls a real
      Celery task, and renders real `comparisons` — zero fixture imports
      left in `SpecShield.jsx`.
- [ ] Component-registry parity test exists and passes.
- [ ] A `401` mid-flow sends the user to login and can resume the session,
      not a dead-end message.
- [ ] `npm test` exists and passes; existing `pytest` suite still passes
      in full.
- [ ] Deploy env vars verified against the live Render + Vercel URLs;
      `GEMINI_MODEL` confirmed valid; one real end-to-end smoke run
      pasted into the delivery notes.

---

## 5. Hard constraints (do not violate)

- **Never bypass `services/llm.py`'s validate-then-retry-once contract.**
  Every new LLM call (the `visual_theme` addition included) goes through
  `generate_structured_output` with a Pydantic schema — no raw
  unvalidated `model.generate_content` calls anywhere.
- **No fabricated data, ever, in a shipped view.** Where real data is
  missing, show an honest empty/loading/error state — never a plausible
  fake number, log line, or agent status. This is the same rule that
  governs the mutation prompt's existing "omit the widget rather than
  fabricate a value" instruction — extend it to the whole frontend, not
  just blueprint generation.
- **Tenant isolation stays absolute.** Every new query filters by
  `current_user.tenant_id`, matching the existing pattern in every route
  file — no cross-tenant reads, ever, including in new SpecShield polling
  code.
- **Don't touch `component_registry.py`'s allowed set or the retry
  contract in `llm.py`** while doing this work — this prompt is about
  wiring what exists, not redesigning the guardrails.
- **Extend the existing test suites; don't reduce their coverage.** If a
  task here changes a schema (T3's `visual_theme`), update the fixtures
  that reference it rather than deleting the assertions around it.
