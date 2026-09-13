# Diwaan — Multi-Business Work Order
## One account (one email) holds many businesses. Each business has its own dashboard, its own data, its own name. A new interview *adds* a business; it never overwrites one.

**Written:** 2026-09-11
**For:** implementer (Antigravity or equivalent)
**Depends on:** the Master Work Order (2026-09-08) landing — the interview, the
data layer, and the 6-component vocabulary are assumed present and green.

---

## 0. The brief

Today the data model is **one dashboard per tenant**, enforced at the schema
level: `TenantDashboard.tenant_id` is the primary key. The onboarding
interview *upserts* that single row — running it again **replaces** the
owner's dashboard. The dashboard-data tables (`widget_values`,
`widget_series_points`, `ledger_events`) are keyed by `tenant_id`, so two
businesses that both have, say, a `monthly_revenue` metric would collide on
one value.

A real business owner has more than one business — a shop *and* a workshop,
a farm *and* a trading arm. Diwaan must let one login carry several
businesses side by side, switch between them, add a new one, rename, and
delete — with each business's dashboard and live data fully isolated from
the others.

**This is a schema + migration + API + frontend change. Do it in this order:
model → migration → API → onboarding → frontend → tests.** Every HARD
constraint in §7 holds throughout.

---

## 1. Current state — read before touching anything

- **`backend/models/diwaan.py`** — `TenantDashboard`: PK is `tenant_id`
  (`UUIDType`, FK `tenants.id`). Columns: `archetype_id`, `business_summary`,
  `customized_parameters` (JSON — also holds `binding_catalog` and
  `visual_theme`), `active_widgets` (JSON), `generated_at`, `version`.
  `Tenant.dashboards` relationship exists but only ever has one row.
- **`backend/models/widget_data.py`** — `WidgetValue` PK `(tenant_id, key)`;
  `WidgetSeriesPoint` has `tenant_id` + `key` + `ts` + index
  `ix_series_tenant_key_ts`; `LedgerEvent` has `tenant_id` + `key`.
- **`backend/models/onboarding.py`** — `OnboardingSession.resulting_dashboard_id`
  is `UUIDType`, nullable, FK `tenant_dashboards.tenant_id`.
- **`backend/api/diwaan.py`** — `GET /api/dashboards/{tenant_id}` returns one
  `Blueprint`; there's a create-if-missing path around line 68–96.
- **`backend/api/onboarding.py`** — completion block ~line 421–460: selects
  the tenant's dashboard, updates in place if it exists else inserts, then
  `session.resulting_dashboard_id = dash.tenant_id`. `get_session()` ~line
  493 looks the blueprint up by `tenant_id`.
- **`backend/api/dashboard_data.py`** — every route is
  `/api/dashboards/{tenant_id}/...`; `_assert_tenant(tenant_id, current_user)`
  is the isolation check; `valid_keys` comes from that dashboard's
  `customized_parameters["binding_catalog"]`.
- **Frontend** — `App.jsx` boot: after auth, `GET /api/dashboards/{tid}`;
  200 → `view='diwaan'` with the blueprint, non-200 → `view='specshield'`.
  `LandingPage.jsx` renders the one blueprint or the interview; the nav has
  a prominent **"↻ Start New Interview"** button that opens a confirm modal
  whose copy says *"Your current dashboard will be replaced."*
  `BlueprintRenderer` and the widgets take a `tenantId` prop and call
  `/api/dashboards/${tenantId}/data/...`.
- **Local dev DB is SQLite** (`dev.db`), prod is Postgres. Alembic is
  configured; there are **no migration versions written yet** — a
  `create_all` on startup is the current stopgap. This work order adds the
  first real migration.

---

## 2. Model changes (`backend/models/`)

### 2.1 `TenantDashboard`
- Add `id = Column(UUIDType, primary_key=True, default=uuid.uuid4)`.
- `tenant_id` → **drop `primary_key=True`**; keep it
  `Column(UUIDType, ForeignKey("tenants.id"), nullable=False, index=True)`.
- Add `name = Column(String, nullable=False)` — the business's display name
  (e.g. "Sharma Tiles", "Sharma Provision Store").
- Add `created_at = Column(DateTime, default=datetime.utcnow, nullable=False)`.
- Add `last_opened_at = Column(DateTime, nullable=True)` — for "most recent"
  ordering in the switcher.
- Keep `generated_at` (now means "last regenerated"), `version`.
- `tenant`/`archetype` relationships unchanged; `Tenant.dashboards` is now a
  genuine collection.

### 2.2 `WidgetValue`, `WidgetSeriesPoint`, `LedgerEvent`
- Add to all three:
  `dashboard_id = Column(UUIDType, ForeignKey("tenant_dashboards.id", ondelete="CASCADE"), nullable=False, index=True)`.
- `WidgetValue` PK becomes **`(dashboard_id, key)`** (was `(tenant_id, key)`).
- **Keep the `tenant_id` column** on all three (denormalised) so the
  isolation assert stays a cheap column comparison — but it is now
  secondary; `dashboard_id` is the scoping key.
- `WidgetSeriesPoint`: replace `ix_series_tenant_key_ts` with
  `ix_series_dashboard_key_ts` on `(dashboard_id, key, ts)`.

### 2.3 `OnboardingSession`
- `resulting_dashboard_id` FK target changes from
  `tenant_dashboards.tenant_id` → `tenant_dashboards.id`. Column type/name
  unchanged.

---

## 3. Migration (`backend/alembic/versions/…`) — REQUIRED, reversible, SQLite-safe

`create_all` cannot ALTER existing tables. Write **one** Alembic revision,
`multi_business_dashboards`, as the first real version (down_revision = the
current head, which is `None` — set it accordingly and make this the head).

Use `op.batch_alter_table(...)` for every ALTER / PK / FK change — SQLite
has no native `ALTER … DROP CONSTRAINT` and batch mode is the only portable
path. Test on SQLite **and** describe the Postgres path in a comment.

**upgrade():**
1. `tenant_dashboards`:
   - add `id` (UUID) — populate every existing row with a fresh uuid.
   - add `name` — backfill `= COALESCE(NULLIF(TRIM(business_summary), ''), 'My Business')`,
     truncated to 60 chars.
   - add `created_at` (= `generated_at` for existing rows, else now),
     `last_opened_at` (= `generated_at`).
   - drop the PK on `tenant_id`; add PK on `id`; add an index on `tenant_id`.
2. `widget_values`:
   - add `dashboard_id` (nullable first).
   - backfill:
     `UPDATE widget_values SET dashboard_id = (SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = widget_values.tenant_id)`.
   - delete any rows still NULL (orphans), then make `dashboard_id` NOT NULL.
   - drop PK `(tenant_id, key)`; add PK `(dashboard_id, key)`.
3. `widget_series_points`, `ledger_events`:
   - add `dashboard_id`, same backfill, drop-null, NOT NULL.
   - swap the series index to `(dashboard_id, key, ts)`.
4. `onboarding_sessions`: no column change; the FK retarget is metadata only
   (note it, no data migration needed — values already hold the tenant_id
   which now needs mapping: `UPDATE onboarding_sessions SET resulting_dashboard_id = (SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = onboarding_sessions.resulting_dashboard_id) WHERE resulting_dashboard_id IS NOT NULL`).

**downgrade():** reverse it — collapse back to one dashboard per tenant by
keeping, per tenant, the row with the newest `generated_at`; re-key the data
tables to `tenant_id`; drop the added columns. It's lossy (extra businesses
are dropped) — say so in a docstring.

Wire `alembic upgrade head` to run on backend startup (before the existing
`create_all`, which stays only as a safety net for a truly empty DB). Add a
one-line note to `CONTEXT.md` that migrations are now the source of truth.

---

## 4. API changes

### 4.1 `backend/api/diwaan.py` — dashboards are now a collection
All routes stay tenant-scoped through `current_user.tenant_id`.

- `GET /api/dashboards` → `list[DashboardSummary]`
  `{ id, name, archetype_id, business_summary, generated_at, last_opened_at }`
  for every dashboard whose `tenant_id == current_user.tenant_id`, ordered
  by `COALESCE(last_opened_at, created_at)` desc.
- `GET /api/dashboards/{dashboard_id}` → `Blueprint`
  404 unless the row exists **and** `row.tenant_id == current_user.tenant_id`.
  Side effect: set `last_opened_at = now()`, commit.
- `POST /api/dashboards/{dashboard_id}/rename` → body `{ name: str }` (1–60
  chars, trimmed, non-empty) → returns the updated `DashboardSummary`.
- `DELETE /api/dashboards/{dashboard_id}` → cascade-delete its
  `widget_values` / `widget_series_points` / `ledger_events`, then the row.
  Allowed even if it's the tenant's last one. Returns `{ ok: true }`.
- **Compat shim:** keep `GET /api/dashboards/{tenant_id}` working *only*
  when the path id equals `current_user.tenant_id` — return the
  most-recently-opened dashboard's `Blueprint`. Mark it deprecated in the
  docstring; the frontend must stop calling it.

### 4.2 `backend/api/dashboard_data.py` — re-key from tenant to dashboard
- Every path `/{tenant_id}/…` → `/{dashboard_id}/…`.
- Replace `_assert_tenant` with
  `async def _load_owned_dashboard(dashboard_id, current_user, db) -> TenantDashboard`
  that 404s unless the dashboard exists and `dashboard.tenant_id ==
  current_user.tenant_id`. Use its return value for the `binding_catalog`
  check.
- Every `WidgetValue` / `WidgetSeriesPoint` / `LedgerEvent` query filters by
  `dashboard_id` (not `tenant_id`). On write, set **both** `dashboard_id`
  and `tenant_id` (= `current_user.tenant_id`).
- The `valid_keys` binding-violation check reads
  `dashboard.customized_parameters["binding_catalog"]` of *that* dashboard.
  Keep the existing 422 message containing the phrase
  `"not in this dashboard"` (a test asserts it).

### 4.3 `backend/api/onboarding.py` — every completed interview CREATES
- The completion block (~421–460): **delete the "update existing in place"
  branch entirely.** Always
  `dash = TenantDashboard(id=uuid4(), tenant_id=current_user.tenant_id, name=<business name>, …)`
  and `db.add(dash)`.
- Business name: prefer `session.collected_data.get("business_name")`. If the
  interview didn't capture one, fall back to
  `blueprint.business_summary[:60]` or `"My Business"`.
- `session.resulting_dashboard_id = dash.id`.
- `get_session()` blueprint lookup: `TenantDashboard.id == session.resulting_dashboard_id`.
- **Interview prompt:** add "the business's name" to the coverage model as a
  cheap early fact — one line in `SYSTEM_PROMPT` ("Early on, get the name the
  owner calls this business.") and let `extracted_facts` carry
  `business_name`. Don't add a rigid scripted question; the model asks it
  naturally. If still missing at generation, the fallback above covers it.

---

## 5. Frontend changes

### 5.1 Active-dashboard state
- Persist the selected id in `sessionStorage` as
  `diwaan_active_dashboard_id`. Add helpers next to the existing
  session-storage accessors in `api/client.js`.

### 5.2 `App.jsx` boot
- After auth: `GET /api/dashboards`.
  - `[]` → `view='diwaan'`, no blueprint → interview starts (unchanged
    downstream).
  - `≥1` → use the stored active id if it's still in the list, else the
    first (most-recent). `GET /api/dashboards/{id}` → `view='diwaan'` with
    that blueprint.
- SpecShield is no longer the "no dashboard" fallback — it's only reached
  from the nav toggle.
- Pass `dashboardId` (not `tenantId`) down to `LandingPage` →
  `BlueprintRenderer` → widgets. Grep `frontend/src` for
  `dashboards/${tenantId}` and `tenantId=` props and migrate them.

### 5.3 Business switcher (in `LandingPage.jsx` nav)
- A control showing the **active business name** + chevron. Opens a panel:
  - the tenant's businesses (name + small archetype badge), click to switch
    (`GET /api/dashboards/{id}`, update sessionStorage, swap
    `activeBlueprint`, re-render — no full reload);
  - a divider;
  - **"＋ Add a business"** → clears `activeBlueprint`, calls
    `startNewSession()`. On completion, re-fetch `GET /api/dashboards`, set
    the newest as active, render it. **Other businesses untouched.**
  - each row has a kebab: **Rename** (inline text field →
    `POST …/rename`), **Delete** (confirm: *"Delete ‹name› and all its
    data? This can't be undone."* → `DELETE …` → if it was active, fall
    back to the next business, or the interview if none remain).

### 5.4 Fix the now-wrong confirm copy
- The "↻ Start New Interview" button becomes **"＋ Add a business"** (keep it
  in the nav too, not only in the switcher panel, for discoverability).
- Modal copy → heading **"ADD A NEW BUSINESS"**, body: *"We'll ask a few
  questions and build a dashboard for this business. Your other businesses
  stay exactly as they are."* CTA: **"Start"**.
- The existing start-failure error card + "Try again" (added 2026-09-11)
  stays as-is.

### 5.5 Empty/first-run
- New account or zero businesses → straight into the interview, no picker.
- After the first business is built, the switcher appears.

---

## 6. Tests

**Backend (`backend/tests/`):**
- `test_multi_business.py`:
  - two completed interviews for one tenant → `GET /api/dashboards`
    returns 2; each `GET /api/dashboards/{id}` returns the right blueprint.
  - `PUT …/{dash_A}/data/monthly_revenue` does **not** appear in
    `GET …/{dash_B}/data`.
  - tenant B's token → `GET /api/dashboards/{dash_A_id}` = 404;
    `PUT …/{dash_A_id}/data/x` = 404.
  - `DELETE /api/dashboards/{dash_A_id}` removes its widget rows
    (assert `widget_values` count for that id is 0).
  - second interview leaves the first dashboard's row and data intact.
- Update `test_dashboard_data.py`, `test_onboarding.py`,
  `test_interview_coverage.py`: they create dashboards via
  `TenantDashboard(tenant_id=…)` and hit `/api/dashboards/{tenant_id}/…` —
  give each a real `id` and call the `{dashboard_id}` routes. Keep the
  `"not in this dashboard"` assertion in `test_binding_violation`.
- `test_migration.py`: on a seeded SQLite DB, `alembic upgrade head` then
  `alembic downgrade -1` run clean; after upgrade, a pre-existing
  single-dashboard tenant still resolves through the compat shim and its
  widget data is reachable by the new `dashboard_id`.

**Frontend:** `npm run build` green. If a component test harness exists,
add one for the switcher (list renders, "＋ Add a business" triggers the
interview, delete confirm gates the call).

---

## 7. HARD constraints

- **Isolation is absolute.** Every dashboard and dashboard-data query
  filters by `current_user.tenant_id`; dashboard-data routes additionally
  verify `dashboard_id` belongs to that tenant. No endpoint trusts a path
  id alone.
- **No fake data.** A newly added business starts with honest empty
  widgets, exactly as today.
- **The Blueprint contract and the closed 6-component vocabulary are
  unchanged.** This work order touches persistence and routing, not the
  schema in `backend/schemas/blueprint.py`.
- **One Alembic head.** The migration is reversible and runs on SQLite via
  batch mode. Startup runs `upgrade head`.
- **Green gates:** all `backend` tests pass; `cd frontend && npm run build`
  succeeds.
- **No secrets in the repo**; `.env` files stay gitignored.
- Keep diffs surgical and match surrounding style. Don't reformat files you
  didn't need to change.

---

## 8. Definition of done

1. One demo account, two interviews → two named businesses in a switcher,
   each with its own dashboard and independent live data.
2. "＋ Add a business" adds a third without disturbing the first two.
3. Rename and delete work; deleting the active one falls back gracefully.
4. An existing (pre-migration) dashboard survives `alembic upgrade head`
   with its data intact and shows up as one business in the switcher.
5. All backend tests green; `npm run build` green.
6. Short entry appended to `CONTEXT.md` (multi-business model + "migrations
   are the source of truth now").
