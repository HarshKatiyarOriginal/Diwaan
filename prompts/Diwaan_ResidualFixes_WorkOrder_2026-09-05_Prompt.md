# Diwaan — close the remaining gaps
## Follow-up to `Diwaan_PostWiring_Fixes_WorkOrder_2026-09-05_Prompt.md`

**Written:** 2026-09-05
**For:** implementer (Antigravity or equivalent)
**Goal:** The last pass correctly fixed all 10 reported findings — JWT
decoding, `visual_theme` persistence, the SpecShield poll leak, the
`createSession` dead-end, 401 handling, the theme-fallback duplication, and
the `JSONType`/`UUIDType` centralization all check out against the actual
code. This pass closes four things the last one left behind: one narrow but
real bug in the same class as the last one, and three new regression tests
that don't actually exercise what they claim to. No new features.

---

## 1. The resume-after-401 fix has one gap left: a 401 during the resume-check itself

**`frontend/src/LandingPage.jsx`, inside `init()`'s `pendingSessionId` branch
(~lines 64–87).**

```js
if (pendingSessionId) {
  const res = await apiFetch(`/api/onboarding/sessions/${pendingSessionId}`);

  if (res.ok) {
    const sessionData = await res.json();
    if (sessionData.status === 'in_progress' && sessionData.question) {
      sessionStorage.removeItem('pending_session_id');
      ...
      return;
    }
    if (sessionData.status === 'complete' && sessionData.blueprint) {
      sessionStorage.removeItem('pending_session_id');
      ...
      return;
    }
  }
  sessionStorage.removeItem('pending_session_id');   // <-- runs on 401 too
}
```

The last fix correctly stopped `App.jsx`'s `clearSession()` from deleting
`pending_session_id`. But this GET — the one that *checks* whether the
pending session is resumable — can itself come back `401` (the freshly
issued token can still be invalid/expired in some edge cases, or the token
in `sessionStorage` at call time doesn't match what was just issued). When
that happens, `res.ok` is `false`, neither inner branch runs, and the final
line unconditionally removes `pending_session_id` anyway — treating "auth
failed while checking" the same as "session isn't resumable." `apiFetch`
will also fire the global `onAuthExpired` callback for this same 401 (that
part is fine), but by the time the user re-logs in, the id needed to
resume is already gone.

**Fix:** only remove `pending_session_id` when the response was genuinely
resolved as *not resumable* — i.e. `res.ok` was true but the session's
status wasn't `in_progress`/`complete` with the expected payload (a
legitimately dead/abandoned/malformed session). On a `401` specifically,
leave `pending_session_id` alone and let it fall through to the fresh-session
path being routed to `onAuthExpired` — which is what already happens right
below for the fresh-session POST — so a repeated login attempt gets another
chance to resume. Concretely: check `res.status === 401` before the
"not resumable" cleanup and skip the removal in that case (falling straight
through, same as how the fresh-session POST already handles its own 401 a
few lines down).

Add a test: mock the resume-check GET to return 401, assert
`pending_session_id` is still present in `sessionStorage` afterward.

---

## 2. `specshield.test.jsx` never actually starts a poll — it can't catch a regression of the bug it's named for

**`frontend/src/__tests__/specshield.test.jsx`.** The test renders
`SpecShield`, unmounts it, advances fake timers, and asserts no further
`fetch` calls happened. But nothing in the test ever confirms the
"new project" modal or uploads a file — both `createSession` and `pollTask`
require user interaction that this test never simulates. No interval is
ever created, so "zero additional fetches after unmount" is true whether or
not the interval-clearing fix in `pollTask`/the unmount effect actually
works. This test would pass identically against the original buggy code.

**Fix:** drive the test through the real path — render `SpecShield`, use
Testing Library to fill in and submit the project-name modal (mock
`POST /api/specshield/sessions` to succeed), then simulate a file upload
(mock the upload endpoint to return `{status: 'processing', task_id:
'...'}`) so `pollTask` actually starts an interval, *then* unmount and
advance timers, and assert no further `/api/tasks/...` fetches occur. If
mocking the full upload flow is awkward in a unit test, at minimum export
`pollTask`'s start-a-poll capability in a way the test can trigger directly
(e.g. test the polling behavior at a lower level than the full component) —
but the current test must not ship as the only coverage for this fix, since
it doesn't cover it at all.

---

## 3. `resume.test.jsx` tests a copy of `clearSession()`, not the real one

**`frontend/src/__tests__/resume.test.jsx`.** The test manually calls
`sessionStorage.removeItem('diwaan_token')` and
`sessionStorage.removeItem('diwaan_tenant_id')` inline, with a comment
"Simulate clearSession behavior from App.jsx" — it never imports or calls
the actual `clearSession` function from `App.jsx`. If that function
regresses again (e.g. someone re-adds the `pending_session_id` removal, or
changes what it clears), this test keeps passing because it isn't testing
the real code, only a hand-copied re-implementation of what it used to do.

**Fix:** export `clearSession` from `App.jsx` (or extract it into
`frontend/src/api/client.js` next to `setOnAuthExpired`/`apiFetch`, which is
arguably the more correct home for it now that session lifecycle lives
there) and have the test import and call the real function. While doing
this, also add the case from §1 above: a 401 during the resume-check itself
should leave `pending_session_id` intact.

---

## 4. `visual_theme` round-trip test only covers half the fix

**`backend/tests/test_visual_theme.py`,
`test_visual_theme_roundtrips_session_and_dashboard_endpoints`.** This test
correctly verifies `generate_blueprint` → `GET /api/dashboards/{tenant_id}`.
It does not touch `GET /api/onboarding/sessions/{id}` at all — the
`get_session()` fix in `backend/api/onboarding.py` (returning
`visual_theme` when reconstructing a `Blueprint` for a resumed/completed
session) is correct by inspection but has zero test coverage. This was the
actual path the original bug report was about (session resume), and it's
the one now left unverified.

**Fix:** extend the same test (or add a sibling one) that drives a
conversational onboarding session through to `status: "complete"` (mock the
LLM calls the same way the existing test does), then calls
`GET /api/onboarding/sessions/{session_id}` and asserts the returned
blueprint's `visual_theme` matches what was generated — not just
`GET /api/dashboards/{tenant_id}`.

---

## 5. Acceptance checklist

- [ ] A 401 on the resume-check GET (not just the respond()/POST 401 from
      before) leaves `pending_session_id` intact — covered by a test.
- [ ] `specshield.test.jsx` actually triggers `pollTask` (via a simulated
      upload or a lower-level trigger) before asserting no post-unmount
      fetches — the test fails against a reintroduced leak, not just against
      no leak at all.
- [ ] `resume.test.jsx` imports and calls the real `clearSession` (or its
      new home), not an inline re-implementation.
- [ ] `test_visual_theme.py` covers `GET /api/onboarding/sessions/{id}`
      returning the correct `visual_theme`, not only the dashboard endpoint.
- [ ] Existing `pytest` suite and `npm test` (Vitest) both still pass in
      full.

---

## 6. Hard constraints (unchanged)

- No fabricated data in any shipped view.
- Tenant isolation stays absolute.
- Don't weaken or remove the fixes from the last two passes while closing
  these gaps — extend them.
