# Diwaan — project context

*Briefing for an AI assistant or a new contributor. Reflects what's
actually in the repo. Last updated: 2026-09-08.*

---

## 1. What it is

An AI onboarding platform: a business owner has a conversational interview
with the app, and from that conversation the AI generates a dashboard
specific to their business — the right widgets, tracking the right
operational facts, sized for that owner.

Three design ideas:
1. **Authority** — one command center over a fragmented SMB's operations
   (inventory, cash, labour, compliance).
2. **Adaptive Foundations** — it starts from a pre-built sector archetype
   (`farmer` / `shopkeeper` / `factory_owner`), not from nothing.
3. **Formless Intelligence** — the interview mutates that archetype into a
   bespoke, schema-validated JSON **Blueprint**. Same `factory_owner`
   baseline becomes a tile-plant dashboard (kiln temps, firing batches)
   or a dairy one (cold-chain temp, milk intake).

## 2. Repo layout

Diwaan and **Spec Shield** (an AI document-auditing tool for construction
procurement — OCR + Gemini comparison of blueprint-vs-invoice specs) share
**one repo and one running app**. It opens on Spec Shield; a "Launch
DIWAAN" button transitions into the Diwaan side. Same auth, backend, and
frontend bundle. Spec Shield is the team project; Diwaan is an individual
extension on the same codebase.

Frontend is **Vite + React 19** (an early proposal draft mentioned Next.js;
the code has never used it).

## 3. Architecture

**Backend** (`backend/`) — FastAPI, async SQLAlchemy, Postgres in prod /
SQLite locally. Gemini via `google-generativeai`.

- **All LLM calls go through `services/llm.py` →
  `generate_structured_output()`**: forces JSON, parses into a Pydantic
  schema, retries once with the validation error fed back. Never bypass.
- Alembic is configured but **no migration versions are written** — the
  schema is only ever created by `Base.metadata.create_all` in
  `scripts/seed_archetypes.py`. See §5.
- Celery + Redis run Spec Shield's doc processing (`worker/tasks.py`).
  Not used by Diwaan.
- Modules: `api/onboarding.py` (the interview loop → classify → mutation
  prompt → `Blueprint`), `api/diwaan.py` (blueprint generate / dashboard
  fetch), `api/specshield.py`, `api/dashboard_data.py` (per-tenant widget
  values / series / ledger events), `schemas/blueprint.py` (the
  `Blueprint` / `Widget` / `DataBinding` contract),
  `schemas/component_registry.py` (the **closed 6-component vocabulary**,
  mirrored on the frontend, with a parity test), `models/`
  (`__init__.py` imports all; `db/types.py` is the single `JSONType` /
  `UUIDType` source).

**Frontend** (`frontend/`) — React 19 + Vite 8, no router, plain
`useState` views in `src/App.jsx` (`auth` / `specshield` / `diwaan`).
`three` for the `ThreeDiwaanSeal` centerpiece.

- `src/api/client.js` — the **shared** `apiFetch` (attaches the JWT,
  handles 401 globally), `decodeJwtPayload` (base64url), `clearSession`.
  Everything uses it; nothing hand-rolls fetch + auth.
- `src/BlueprintRenderer.jsx` maps `blueprint.active_widgets[]` → the 6
  components by `component_name` + `grid_position`.
- `src/styles/tokens.css` (design tokens) + `glass.css` (glass classes).

## 4. Core flow

Register/login → JWT (`user_id`, `tenant_id`, 30-min expiry; every query
filters by `current_user.tenant_id`). → `GET /api/dashboards/{tenant_id}`;
if none, run the interview (`POST /api/onboarding/sessions`, `.../respond`
— one concrete question per turn, accumulating `collected_data`). →
classify archetype → mutation prompt builds a `Blueprint` from the
archetype `base_template` + facts (includes `visual_theme`). → persisted
to `TenantDashboard`, rendered by `BlueprintRenderer`. → widgets carry a
`DataBinding`; the owner enters real values; `MetricCard` trends come from
`WidgetSeriesPoint` history.

## 5. Current state

**Committed `main` (through `e2b43a3`) — stable.** Backend↔frontend wired,
real JWT auth, SpecShield session history + settings, design tokens +
glass, a Three.js seal scaffold. `pytest` + `npm test` green.

**Uncommitted working tree — in progress, has known blockers.** A large
pass (~2,200 lines: interview coverage model, a widget data layer, all 6
widgets rewritten, seal post-processing). A code review found it not yet
shippable — main blockers:

- **No DB migrations** for the new `OnboardingSession` columns
  (`coverage_map`, `binding_catalog`, …) and 3 new tables → any existing
  DB 500s on the first interview. (Locally: rebuild `dev.db`, §6.)
- **Pre-existing dashboards 500 on read** — the new "no literal data in
  props" validator rejects the shape old dashboards were saved in.
- **The coverage-readiness gate is dead code** — `_is_ready_to_generate()`
  is computed and discarded; the interview still ends only on the LLM's
  call or an 18-question cap.
- **A terse interview can produce a blank dashboard** (`active_widgets:
  []`) — the mutation prompt omits widgets not in the catalog and nothing
  enforces a minimum.
- **The seal's post-processing never runs** — `ThreeDiwaanSeal.jsx` uses
  `require('three/examples/jsm/...')` in a Vite/ESM bundle; it throws and
  is swallowed, so bloom/grain/env-map silently don't load.
- Smaller: `put_widget_value` skips key validation on an empty catalog;
  the Gemini model-error check false-positives on `"404"` in model output;
  `ChartWidget` can hang on a loading shimmer; a WebGL context leak for
  reduced-motion users; the "no fabricated data" check is a 6-name
  denylist that misses `status`/`label`/`delta`/`unit`.

For a demo, either fix the top blockers or run from the last good commit.
Full findings are in `prompts/` history and the review transcript.

## 6. Running locally

No Docker / Postgres / Redis on the dev machine. Python 3.14, Node 24.
Local-only overrides (gitignored):

- `backend/.env` — `DATABASE_URL` → SQLite (`dev.db`);
  `GEMINI_MODEL=gemini-3.6-flash` (the repo default `gemini-1.5-flash` is
  retired and 404s).
- `backend/venv/Lib/site-packages/magic.py` — a hand-written stub
  (`python-magic-bin` segfaults on Python 3.14).
- `frontend/.env` — `VITE_DEV_AUTOLOGIN=true` skips the login screen
  (auto-login as `demo@diwaan.local` / `secret`; the code path defaults
  off, so prod is unaffected).
- Rebuild the dev DB after a schema change:
  ```
  rm dev.db
  backend/venv/Scripts/python.exe -m backend.scripts.seed_archetypes
  TEST_DATABASE_URL="sqlite+aiosqlite:///C:/…/Diwaan/dev.db" \
    backend/venv/Scripts/python.exe scripts/seed_demo_user.py
  ```
- Launch: `.claude/launch.json` → `diwaan-backend` (uvicorn, :8000) +
  `diwaan-frontend` (vite, :5173).
- Spec Shield doc *processing* won't complete locally (no Celery worker) —
  the UI works up to upload.

## 7. Invariants — don't regress these

- JWT decode is **base64url** (`decodeJwtPayload`), never raw `atob`.
- `pending_session_id` survives a 401, including one during the
  resume-check GET.
- `visual_theme` round-trips through **both** `GET
  /api/onboarding/sessions/{id}` and `GET /api/dashboards/{tenant_id}`.
- SpecShield poll timers: cleared on unmount, overlap-guarded, debounced.
- Every authenticated fetch goes through the shared `apiFetch`.
- The **closed 6-component vocabulary** + its parity test.
- `services/llm.py`'s validate-then-retry-once contract — never bypassed.
- Tenant isolation on every query.
- No fabricated data in any shipped view — no value → empty state, never
  a plausible fake number.
- `pytest` + `npm test` stay green; extend tests, don't weaken them.

## 8. The `prompts/` folder

Dated work-order specs handed to Antigravity (an agentic coding tool run
alongside these chats). The current target is
`Diwaan_Master_WorkOrder_2026-09-08` (interview coverage model → real
data-bound widgets → visual system); that's the pass in §5's working tree.

## 9. Team

BCS-554 mini project. Ayush Dixit, Ayush Mishra, Ayushi Gupta, Aviral
Jain, Harsh Katiyar, Nikhil Singh Bhadouriya.
