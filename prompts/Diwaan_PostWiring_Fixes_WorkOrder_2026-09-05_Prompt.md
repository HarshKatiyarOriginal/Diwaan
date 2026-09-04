# Diwaan — fix what the wiring pass introduced
## Follow-up to `Diwaan_BringToReality_WorkOrder_2026-09-04_Prompt.md`

**Written:** 2026-09-05
**For:** implementer (Antigravity or equivalent)
**Goal:** The previous work order asked for the real backend to be wired to
the real frontend, and that landed — auth, live onboarding, SpecShield
upload/polling, and a `visual_theme` fix are all real now. A code review of
that diff (7 independent finder passes + targeted verification) found **four
bugs severe enough to block shipping**, plus a consistent pattern of
duplicating the same fix in 3–4 places instead of centralizing it once —
which is directly how two of those four bugs happened. This prompt fixes
what's there. It asks for no new features.

---

## 0. Stop-ship: login silently fails for a large share of real tokens

**`frontend/src/components/AuthScreen.jsx`, line 56.**

The JWT payload is decoded with plain `atob()`:
```js
const payload = JSON.parse(atob(access_token.split('.')[1]));
```
The backend (`python-jose`) encodes JWTs as **base64url** per RFC 7519 —
`+`→`-`, `/`→`_`, padding stripped. Plain `atob()` implements RFC 4648
standard base64 and does not understand that alphabet; it throws
`InvalidCharacterError` on any `-`/`_` in the input. Any token whose payload
segment happens to contain one of those characters (common at typical
payload length, not a rare edge case) makes this line throw. The error is
technically caught by `handleSubmit`'s try/catch, but the user just sees a
generic failure message and never gets past the auth screen — **even though
login succeeded on the backend and the token is valid.**

**Fix:** decode base64url properly before `JSON.parse` — replace `-`→`+`,
`_`→`/`, re-pad to a multiple of 4 with `=`, then `atob()`. (Or have the
login response return `tenant_id`/`user_id` directly instead of decoding the
token client-side at all.) Add a test that logs in with a token whose
payload is known to contain `-`/`_` and asserts the app proceeds past the
auth screen.

---

## 1. Stop-ship: the theme fix doesn't survive session resume or the alternate generate-blueprint path

Three independent review passes converged on this. The whole point of the
last work order's biggest fix was: stop dashboards from silently rendering
with the wrong theme. That fix (`visual_theme` on `Blueprint`) does not
reach the client in two of the paths that return a `Blueprint`:

1. **`backend/api/onboarding.py`, `get_session()` (~lines 226–234).** When
   reconstructing `Blueprint` from a `TenantDashboard` row for a completed
   session, every field is copied across **except `visual_theme`** — compare
   against `backend/api/diwaan.py`'s `get_dashboard()`, which reads it back
   correctly. §2 below (resume-after-401) calls exactly this endpoint, so
   this silently reintroduces the "wrong skin" bug via the resume path.
2. **`backend/api/diwaan.py`, `generate_blueprint()` (~lines 71–88).** This
   endpoint (`POST /api/onboarding/generate-blueprint`, still live and
   covered by `test_diwaan.py`) generates a `Blueprint` with a real
   `visual_theme`, but the persist step never merges it into
   `customized_parameters` before saving — so `GET /api/dashboards/{tenant_id}`
   comes back with `visual_theme: null` for any tenant onboarded this way.

**Fix:** `visual_theme` must round-trip through every place a
`TenantDashboard` is written and every place a `Blueprint` is reconstructed
from one — `onboarding.py`'s `respond()` write path already does this
correctly; make `get_session()` and `diwaan.py`'s write+read paths match it.
Add one round-trip test: persist a dashboard with a specific `visual_theme`,
then hit **both** `GET /api/onboarding/sessions/{id}` and
`GET /api/dashboards/{tenant_id}` and assert both return it.

---

## 2. Stop-ship: the resume-after-401 feature deletes its own state before it can be used

**`frontend/src/App.jsx`, `clearSession()` (~lines 79–84), called from
`frontend/src/LandingPage.jsx`'s `handleSendMessage` (~line 150).**

`LandingPage.jsx` sets `sessionStorage['pending_session_id']` right before
calling `onAuthExpired()` on a 401 — the intent (per this feature's own
design, from the last work order) is to let the user resume their
in-progress onboarding session after logging back in. But `onAuthExpired`
routes to `App.jsx`'s `handleAuthExpired`, which calls `clearSession()`, and
`clearSession()` **unconditionally removes `pending_session_id`** from
`sessionStorage` in that same synchronous call chain — deleting the value
immediately after it's set, before the user ever gets back to a screen that
could read it. The advertised resume-after-expiry behavior never actually
resumes anything; every 401 mid-onboarding silently discards the user's
answers and starts a fresh interview after re-login, with no error shown.

**Fix:** `clearSession()` must not remove `pending_session_id` — that key's
whole purpose is to survive the logout/re-login round trip. Clear it
explicitly (and only) once the resume flow has actually consumed it (i.e.
after `LandingPage`'s init effect successfully reads and acts on it), not as
part of the generic auth-clear. Add a test: simulate a 401 mid-interview,
confirm `pending_session_id` survives `handleAuthExpired`, then confirm a
subsequent login actually resumes rather than starting a new session.

---

## 3. Stop-ship: a fresh database never gets an `onboarding_sessions` table

**`backend/scripts/seed_archetypes.py`, imports (~lines 8–11) and the
`Base.metadata.create_all(...)` call.**

The script imports `backend.models.diwaan`, `backend.models.user`, and
`backend.models.specshield` — but never `backend.models.onboarding`.
SQLAlchemy's declarative `Base.metadata` only registers a model's table when
that model's class body has actually executed (i.e. been imported) in the
running process. Since nothing imports `backend.models.onboarding` before
`create_all` runs, `OnboardingSession`'s table is **not created**, even
though every other table is and the script reports success.

**Fix:** import `backend.models.onboarding` alongside the other model
modules before `create_all` runs (or, better: add a `backend/models/__init__.py`
that imports every model module, and have every entry point — this script,
`backend/main.py`'s lifespan, `backend/alembic/env.py` — import from
`backend.models` as a package, so this class of bug can't recur one model at
a time). Verify by running the seed script against a throwaway fresh SQLite
file and confirming `onboarding_sessions` exists afterward — don't just
re-run it against a DB that already has the table from a previous run.

---

## 4. SpecShield's poll timer is never actually cleared on unmount

**`frontend/src/SpecShield.jsx`**, `pollTask` (~line 154) and the unmount
effect (~line 243–244). Three independent review passes converged on this:

```js
useEffect(() => () => { pollRefs.current = {}; }, []);
```
resets the *ref object*, not the interval — the actual `setInterval` handle
is a local variable inside `pollTask` and is never stored anywhere the
cleanup can reach, so unmounting `SpecShield` mid-poll (e.g. clicking
"Launch DIWAAN" right after an upload) leaves the interval firing for up to
3 minutes against an unmounted component.

**Fix, all in the same function while you're in there:**
- Store each interval's handle and `clearInterval` every stored handle on
  unmount.
- The poll callback is `async` but `setInterval` doesn't wait for it — under
  a slow backend, ticks can overlap. Guard with an in-flight flag or switch
  to a self-rescheduling `setTimeout`.
- Each uploaded document gets its own independent poller; two documents
  finishing close together trigger two full `refreshSession(sid)` re-fetches
  back to back. Debounce `refreshSession` (~300ms trailing edge).

Add a test that mounts `SpecShield`, starts a poll, unmounts, and asserts no
further `fetch` happens after unmount (fake timers + a `fetch` spy).

---

## 5. SpecShield has no error recovery for a failed session creation

**`frontend/src/SpecShield.jsx`, `createSession` (~line 124).** If
`POST /api/specshield/sessions` fails, `uploadError` is set — but it only
renders inside a block gated on `sessionId` being truthy, which never
happens on this path, while the "new session" modal has already closed. The
backend briefly returning an error leaves the user stuck on a permanent
"Creating audit session…" state with no visible error and no retry.

**Fix:** render `uploadError` regardless of `sessionId`, and give the user a
retry action.

---

## 6. Theme-fallback logic is inconsistent within the same file

**`frontend/src/LandingPage.jsx`.** `resolveTheme(blueprint)` (~lines
201–211) is the correct, complete fallback chain: `visual_theme` →
`ARCHETYPE_THEME_FALLBACKS[archetype]` → `ARCHETYPES[0]`, used correctly at
the dashboard-render call site (~line 438). The background-image `isActive`
check (~line 244) re-derives only the first two steps inline and drops the
`ARCHETYPES[0]` safety net — if the fallback map is ever missing an
archetype, this computes `undefined`, matches no theme, and every
background `<img>` stays at `opacity: 0`, failing silently.

**Fix:** delete the inline re-derivation at line 244; call
`resolveTheme(activeBlueprint).id` there too.

---

## 7. SpecShield has no 401 handling — fix it by centralizing, not patching a fifth copy

`SpecShield.jsx` makes 4+ authenticated fetches and none check for a 401;
`App.jsx` never even passes it an `onAuthExpired` prop, though it defines
one and wires it into `LandingPage.jsx` for exactly this purpose. Since
SpecShield is the default post-login view, a token expiring mid-audit leaves
every subsequent call silently failing instead of returning the user to
login.

**This, §4, §5, and §6 all trace back to the same root cause:** fetch +
auth-header + error handling is hand-rolled separately in `App.jsx`,
`LandingPage.jsx`, `SpecShield.jsx`, and `AuthScreen.jsx`, and it has
already drifted differently in each file. Fix it at the source: add
`frontend/src/api/client.js` exporting one `apiFetch(path, options)` that
owns `API_BASE_URL`, attaches the auth header, and calls a passed-in
`onAuthExpired` on a 401 before the caller sees the response. Route all four
files through it — don't patch SpecShield's missing 401 handling as a fifth
one-off copy.

While centralizing this, also fix: `App.jsx`'s `boot()` and
`handleAuthSuccess()` both fetch `GET /api/dashboards/{tenant_id}` with
different error handling — share one `checkDashboardAndRoute(token,
tenantId)` helper built on the new `apiFetch`.

---

## 8. Centralize the JSON/UUID column-type shim (currently duplicated 4×)

`backend/models/diwaan.py`, `onboarding.py`, `specshield.py`, and `user.py`
each independently define the identical:
```python
JSONType = JSON().with_variant(JSONB, "postgresql")
UUIDType = UUID(as_uuid=True).with_variant(PG_UUID(as_uuid=True), "postgresql")
```
Move both into a new `backend/db/types.py` and import from there in all four
model files.

---

## 9. Collapse the three theme-mapping sources into one

- `backend/schemas/blueprint.py`: `VISUAL_THEME_IDS` (tuple) and
  `VisualTheme` (Literal) both list the same 5 ids separately — derive
  `VisualTheme` from `VISUAL_THEME_IDS` instead of typing the list twice.
- `ARCHETYPE_THEME_FALLBACKS` is defined separately in
  `backend/schemas/blueprint.py`, `frontend/src/LandingPage.jsx`, and again
  in `frontend/src/__tests__/theme.test.jsx`. At minimum, make the test
  import the real fallback map from `LandingPage.jsx` instead of
  re-declaring its own copy — a test with its own hardcoded expectation can
  pass while the real code has drifted, which is exactly how §1 and §6
  shipped undetected.

---

## 10. Minor cleanup, do if convenient

- `frontend/src/SpecShield.jsx`: `deriveAgents(documents)` and
  `deriveLogs(documents, comparisons)` run unmemoized on every render,
  including every poll tick. Wrap both in `useMemo`.
- `backend/scripts/seed_archetypes.py`: the three archetype widget lists
  share an identical 6-widget skeleton with only content varying — a small
  `make_archetype(...)` builder would remove the copy-paste risk on the
  shared grid layout. Skip if it risks the richer widget content the last
  work order asked for.
- `render.yaml` sets `CORS_ORIGINS: "*"` on the deployed API — tighten to
  the real deployed frontend origin before this goes past a demo.

---

## 11. Acceptance checklist

- [ ] A login whose JWT payload contains `-`/`_` (i.e. most real tokens)
      succeeds — covered by a test.
- [ ] `visual_theme` round-trips through **both** `GET
      /api/onboarding/sessions/{id}` and `GET /api/dashboards/{tenant_id}` —
      covered by one test that checks both.
- [ ] A 401 mid-onboarding, followed by re-login, actually resumes the
      original session — `pending_session_id` survives `handleAuthExpired`.
- [ ] A fresh, empty database seeded via `seed_archetypes.py` ends up with an
      `onboarding_sessions` table, verified against a throwaway DB, not a
      pre-existing one.
- [ ] SpecShield's poll timers are cleared on unmount, overlapping ticks are
      guarded, and near-simultaneous completions collapse into one
      `refreshSession` call — covered by a test.
- [ ] A failed `createSession` shows a visible error with a retry path.
- [ ] `LandingPage.jsx`'s background-image check calls `resolveTheme(...)`
      instead of re-deriving the fallback inline.
- [ ] One shared `apiFetch` used by all four frontend files that talk to the
      backend; SpecShield now redirects to login on a 401 like the rest of
      the app.
- [ ] `backend/db/types.py` holds the single `JSONType`/`UUIDType`
      definition; all four model files import from it.
- [ ] `theme.test.jsx` imports the real `ARCHETYPE_THEME_FALLBACKS` rather
      than hardcoding its own copy.
- [ ] Existing `pytest` suite and `npm test` (Vitest) both still pass in
      full.

---

## 12. Hard constraints (unchanged from the last work order)

- Never bypass `services/llm.py`'s validate-then-retry-once contract.
- No fabricated data in any shipped view.
- Tenant isolation stays absolute — every query still filters by
  `current_user.tenant_id`.
- Extend the existing test suites; don't reduce their coverage.
