# Diwaan — a signature visual system, and the product features it's still missing
## Follow-up to the wiring + fix passes (`Diwaan_BringToReality...`, `Diwaan_PostWiring...`, `Diwaan_ResidualFixes...`)

**Written:** 2026-09-05
**For:** implementer (Antigravity or equivalent)
**Goal:** The last three passes made Diwaan real — auth, live onboarding,
SpecShield, and a validated visual-theme system all work correctly against
the actual backend now. This pass has two halves, both mandatory:

1. **Visual** — right now the product looks like a well-built demo, not a
   piece of signature product design. Make it unmistakably Diwaan's own —
   real glassmorphism (not just translucent rectangles), a 3D centerpiece,
   and motion that feels intentional, not decorative.
2. **Functional completeness** — a handful of "obviously should exist"
   product features are missing entirely: there is no way to see past
   SpecShield audits, no way to revise a generated dashboard once it
   exists, and no settings/profile surface. These need real backend
   endpoints, not just frontend polish.

Neither half is optional. A beautiful shell around missing features is not
done, and a feature-complete app that still looks like unstyled glass boxes
is not done either.

---

## 0. Current state — read before touching anything

**Visual, honestly assessed:**
- `frontend/src/components/DiwaanSeal.jsx` is the closest thing to a
  signature visual element — a small CSS ring/glow logo mark with
  `static`/`generating`/`unlocking` states. It is not 3D and does not scale
  up into a centerpiece.
- Glassmorphism exists but is thin: `backdrop-filter`/`blur(` appears **5
  times** in `LandingPage.css` and **once** in `DiwaanSeal.css`, and **zero
  times** in `SpecShield.css` — SpecShield's "glass panels" are flat
  `rgba(...)` backgrounds with no actual blur, despite reading as glass in
  the JSX class names (`ss-doc-panel`, etc.).
- `frontend/src/themes/archetypes.js` already defines per-archetype
  `backgroundMotif` (`woven-glow`, `horizon-drift`, `blueprint-grid`,
  `frost-shimmer`, `kiln-heat`) and `accentEffect` (`particle-warm`,
  `particle-organic`, `gauge-pulse`, `frost-pulse`, `heat-shimmer`) names —
  **check how much of this is actually implemented in CSS vs. just named
  and unused.** Don't invent a second effect system; finish this one if
  it's half-built, or repurpose these exact names if it's just scaffolding.
- No 3D library exists in `frontend/package.json` today — any 3D work is a
  new dependency, not an extension of something already there.
- No React router, no toast/notification system, no design-token file
  (colors/spacing are inlined per-component via `style={{...}}` throughout
  `LandingPage.jsx` and `SpecShield.jsx`).

**Functional, honestly assessed — grep the actual route files, don't
assume:**
- `backend/api/specshield.py` has exactly 3 routes: create a session,
  upload a document, get one session by id. **There is no `GET
  /api/specshield/sessions` list endpoint.** Once a user navigates away
  from an audit session, there is no way to find it again — SpecShield is
  functionally single-session-per-browser-lifetime.
- `backend/api/diwaan.py` / `onboarding.py` have no endpoint to regenerate
  or reset a tenant's dashboard. Once `TenantDashboard` exists for a
  tenant, `App.jsx`'s boot logic (`checkDashboardAndRoute`) always routes
  straight to the saved dashboard — `LandingPage.jsx`'s onboarding
  `useEffect` explicitly skips itself when `activeBlueprint` is set
  (`if (activeBlueprint) return;`). **A tenant can never re-run onboarding
  or update their dashboard once one exists**, short of an operator editing
  the database by hand.
- There is no settings/profile view anywhere — no way to see your tenant
  name, change your password, or manage anything about your account beyond
  the logout button `App.jsx` already wires up.
- SpecShield has no delete/archive for a session, and no way to export a
  finished audit (the comparison table is the only record, and it's gone
  the moment you navigate away, per the point above).

---

## Part A — Visual system

### A1. A real design-token layer
Before adding effects, give them something consistent to sit on. Add
`frontend/src/styles/tokens.css` (or extend `index.css`) with CSS custom
properties for glass surfaces, blur radii, border treatments, shadow
elevations, and motion durations/easings — used by both `LandingPage` and
`SpecShield` (and anything new). Don't hardcode a fourth `rgba(255,255,255,
0.04)` somewhere; reference the token. Archetype-specific palettes
(`themes/archetypes.js`) stay archetype-specific; this layer is the shared
vocabulary underneath them.

### A2. Finish or fix real glassmorphism, everywhere
- `SpecShield.jsx`'s panels (`ss-doc-panel`, `ss-nav`, sidebar sections,
  the comparison grid, the alert banner) get real `backdrop-filter: blur()`
  glass treatment consistent with what `LandingPage.jsx` already has in
  its 5 existing spots — not just matching rgba backgrounds.
- Add one more "morphism" layer deliberately, not just glass everywhere —
  e.g. soft neumorphic elevation on primary action buttons (Create Session,
  Sign In, Upload) so interactive elements read as physically pressable
  against the glass panels behind them. Pick one consistent neumorphic
  treatment and use it only for primary actions, not everywhere — this is
  an accent, not a replacement for the glass system.
- Verify contrast: every glass panel must keep body text at WCAG AA
  contrast against its busiest possible background (the theme's background
  image at full opacity behind blur) — check this per archetype theme, not
  just the default.

### A3. A 3D centerpiece
Pick **one** approach and document which and why (same decision shape as
prior 3D work in this codebase's sibling projects — procedural/seeded vs. a
licensed asset):
- **Recommended: a `.json` Three.js scene** (`ObjectLoader`-compatible, or
  a small procedural scene serialized to JSON so it's data, not code) at
  `frontend/src/assets/seal.json`, rendered via `three` +
  `three/examples/jsm/loaders/ObjectLoader` (or a lightweight procedural
  generator if you'd rather not hand-author a scene file — either is fine,
  but if you use an asset, it must be an asset you generated/exported
  yourself or a CC0/CC-BY source credited in a `CREDITS.md`, under 1.5MB).
- Replace or upgrade `DiwaanSeal` so its `large` size (used on the
  `generating`/`unlocking` states — the auth loading screen, the vault
  transition, the onboarding "thinking" state) renders this 3D piece
  instead of the current CSS rings. Keep the CSS-ring version as the
  `small`/`micro` size treatment (nav logo, chat avatar) — a full WebGL
  scene for a 16px avatar is wasted work and a performance risk.
  `small`/`micro` staying CSS is a deliberate choice, not a shortcut.
- The 3D piece must be genuinely idle-alive (slow rotation, breathing
  glow, a subtle particle drift) using the seal's existing `state` prop
  (`static`/`generating`/`unlocking`) to drive intensity — `generating`
  should read as visibly "working," `unlocking` as a distinct
  release/reveal motion for the SpecShield→Diwaan vault transition.
- **Performance and fallback are not optional:** wrap the WebGL init in a
  try/catch and fall back to the existing CSS-ring `DiwaanSeal` on failure
  or `webglcontextlost`. Respect `prefers-reduced-motion` (render statically,
  no idle animation). Dispose the renderer/scene/geometry on unmount — this
  component mounts and unmounts repeatedly (auth loading, every vault
  transition, every "thinking" state), so a leak here compounds fast across
  a session; verify with a memory-timeline check across ~10 mount/unmount
  cycles and note the result in your delivery notes.

### A4. Motion and micro-interactions
- The vault transition (`App.jsx`'s `vault-transition-overlay`) and the
  onboarding "compiling blueprint" state are the two highest-visibility
  moments in the product — give both a genuine choreographed sequence (the
  3D seal from A3 is the natural centerpiece of both), not just an opacity
  fade.
- Buttons, inputs, and cards get consistent hover/focus/active states
  using the A1 token layer — check that focus states are actually visible
  for keyboard users, not just mouse hover.
- Toast/inline feedback for actions that currently have none (session
  created, document uploaded, dashboard regenerated once B2 exists) —
  don't add a toast library dependency for this; a small self-contained
  component is enough given the scope.

---

## Part B — Product completeness

### B1. SpecShield session history (backend + frontend)
- Add `GET /api/specshield/sessions` (list, tenant-scoped, newest first) to
  `backend/api/specshield.py`, returning `AuditSessionResponse[]`.
- Add a session-switcher to the SpecShield UI (a sidebar list or a
  dropdown) that lets the user see and reopen past audits, not just the one
  just created. The currently-open session stays exactly as it works today
  once selected (`GET /api/specshield/sessions/{id}` is already correct).
- Add a delete/archive action: `DELETE /api/specshield/sessions/{id}`
  (tenant-scoped, cascades to its documents/comparisons per the existing
  model relationships) plus a confirm-before-destroy UI control.

### B2. Let a tenant revise their dashboard
This is the biggest functional gap — right now onboarding is a one-time,
unrepeatable event.
- Add a way to re-enter onboarding for a tenant that already has a
  dashboard — either a new endpoint that starts a fresh
  `OnboardingSession` regardless of an existing `TenantDashboard` (the
  conversational path already upserts on completion — `respond()`'s
  dashboard-persist logic already handles "existing_dashboard" vs. create),
  or a lighter "edit business facts" endpoint if a full re-interview is
  more than this needs. Pick the one that reuses the most existing code —
  a full re-run of the existing interview loop is likely simpler than a new
  partial-edit flow, since the interview logic already merges
  `collected_data` incrementally.
- Add a **"Refine Dashboard" / "Start Over"** action somewhere reachable
  from the dashboard view (`LandingPage.jsx`, when `activeBlueprint` is
  set) that triggers this — with a real confirmation step, since it
  affects the tenant's live dashboard.
- This must go through the same `visual_theme`-populating mutation prompt
  and the same Pydantic-validated `generate_structured_output` path as the
  original onboarding flow — no shortcut that bypasses the schema
  validation the last three passes were built around.

### B3. A minimal settings/profile view
- One simple view (reachable from a nav/menu item, not a hidden route)
  showing: business/tenant name, the logged-in email, and a way to change
  password. A `PATCH`/`PUT` endpoint on the backend for whichever of these
  are actually editable (tenant name at minimum; password change should
  reuse `core/security.py`'s existing hashing).
- This does not need to be elaborate — a glass panel with a form, styled
  per Part A, using the same `apiFetch` client everything else now uses.

---

## 1. Acceptance checklist

**Visual:**
- [ ] A shared token layer exists and both `LandingPage` and `SpecShield`
      reference it for glass/elevation/motion values.
- [ ] `SpecShield.jsx` has real `backdrop-filter` glass, matching
      `LandingPage`'s existing treatment in quality, not just intent.
- [ ] A working 3D centerpiece renders at `DiwaanSeal`'s `large` size, with
      a WebGL-failure/`webglcontextlost` fallback to the CSS version, respects
      `prefers-reduced-motion`, and is verified not to leak across repeated
      mount/unmount (measured, noted in delivery notes).
- [ ] The vault transition and blueprint-compiling states use the 3D piece
      as a real choreographed moment, not a fade.
- [ ] Keyboard focus states are visibly present on every interactive
      element touched by this pass.

**Functional:**
- [ ] `GET /api/specshield/sessions` exists, tenant-scoped, and the
      frontend lets a user browse and reopen past audits.
- [ ] `DELETE /api/specshield/sessions/{id}` exists with a confirming UI.
- [ ] A tenant with an existing dashboard can trigger a real re-onboarding
      or revision flow, gated behind a confirmation, that goes through the
      same schema-validated generation path as the original flow.
- [ ] A settings/profile view exists, reachable from the UI, backed by a
      real endpoint for whatever it lets the user change.
- [ ] Existing `pytest` suite and `npm test` (Vitest) both still pass, plus
      new tests for the new endpoints (list, delete, dashboard-revise) and
      the 3D fallback path (mock `WebGLRenderer` throwing → CSS seal
      mounts, same pattern as this codebase would use for any WebGL
      fallback).

---

## 2. Hard constraints (unchanged from prior passes, still binding)

- Never bypass `services/llm.py`'s validate-then-retry-once contract —
  B2's revision flow included.
- No fabricated data in any shipped view.
- Tenant isolation stays absolute — B1's list/delete endpoints and B2's
  revision endpoint all filter by `current_user.tenant_id`, no exceptions.
- Don't regress anything fixed in the last three passes: the JWT
  base64url decode, the `pending_session_id` resume behavior (including
  the 401-during-resume-check case), the `visual_theme` round-trip through
  both `get_session` and `get_dashboard`, the SpecShield poll-timer
  cleanup, or the shared `apiFetch`/`decodeJwtPayload`/`clearSession`
  module in `frontend/src/api/client.js` — extend it for any new
  authenticated call, don't hand-roll a new fetch wrapper for B1/B2/B3.
- Any 3D asset added to the repo: CC0/CC-BY if not self-authored, credited
  in `CREDITS.md`, under 1.5MB.
- No new frontend dependencies beyond what Part A's 3D work genuinely
  requires (`three` and its bundled `examples/jsm` addons) — no router,
  animation, or toast library added just for convenience; the existing
  patterns in this codebase (plain `useState`-driven views, inline
  transitions) are deliberate and should be extended, not replaced.
