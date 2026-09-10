# Diwaan — make it iconic
## The visual system, taken all the way. Supersedes the visual half of `Diwaan_SignatureUI_And_Completeness...`

**Written:** 2026-09-08
**For:** implementer (Antigravity or equivalent)
**Goal:** The last visual pass laid a foundation — a real design-token
layer, a small Three.js seal, real glass on SpecShield. It stopped at
"tidy." This pass takes it to **iconic**: a product that looks
authored, expensive, and unmistakably Diwaan's from the first frame —
volumetric 3D, layered morphism, choreographed motion, ambient life —
**without losing a single one of the functional guarantees five prior
fix passes established.** Beauty that breaks a working flow is a
regression, not a feature.

---

## 0. Current state — verified by running the app, read before touching anything

**Stack:** React 19 + Vite 8, `three` **^0.185** already installed (use its
bundled `three/examples/jsm/*` addons freely — not a new dependency). No
router, no animation library, no `framer-motion`. All app logic is plain
`useState`-driven views.

**What exists:**
| Piece | File | Reality |
|---|---|---|
| Design tokens | `frontend/src/styles/tokens.css` | Real and good: `--glass-surface-*`, `--blur-subtle/medium/deep`, `--neumorph-primary-*`, `--shadow-elevation-*`, `--focus-ring-gold`, `--ease-vault`/`--ease-smooth`. **Underused** — only SpecShield really consumes it. |
| 3D seal | `frontend/src/components/ThreeDiwaanSeal.jsx` | A real WebGL scene (gold torus rings + octahedron core + 24-point cloud), 120×120px, `MeshStandardMaterial`, three point/ambient/dir lights. Has `prefers-reduced-motion`, `webglcontextlost`, and full geometry/material/renderer disposal. **But:** tiny, built procedurally in code (no scene asset), **no post-processing** (no bloom/glow/DoF), no environment map, no idle ambient beyond rotation. Reads as "a spinning ring," not "a centerpiece." |
| Seal routing | `frontend/src/components/DiwaanSeal.jsx` | `large` size → `ThreeDiwaanSeal` with a CSS-ring fallback via `onError`; `small`/`micro` → CSS rings (correct — keep WebGL off tiny avatars). |
| Toasts | `frontend/src/components/Toast.jsx` | Self-contained, works (verified live on session-create). |
| SpecShield glass | `frontend/src/SpecShield.css` | Real `backdrop-filter` now, consuming tokens. The strongest-looking screen. |
| Onboarding chat | `frontend/src/components/OnboardingChat.jsx` + `.css` | **Flat hard-edged dark navy rectangle**, no glass, no depth. And a live bug — see §7. |
| AuthScreen | `frontend/src/components/AuthScreen.jsx` | Plain dark card, inline styles, doesn't touch `tokens.css`. |
| Backgrounds | `frontend/public/theme-backgrounds/*.webp` | Placeholder stock photos (picsum). Static. No ambient motion layer. |
| Transitions | `App.jsx` vault-door overlay | The one real moment. Everything else is an opacity swap or nothing. |

**Bottom line:** the scaffolding is right, the ambition isn't there yet.
Don't rebuild the token layer or re-architect the seal component — extend
them hard.

---

## 1. The bar — what "iconic" means here concretely

Think **"an operating system for an empire, rendered as an instrument."**
A high-end command terminal crossed with a jewel. Every surface has
depth; nothing is a flat rectangle. Light moves. The product feels alive
at rest and choreographed in motion. Reference feel: Apple "neural
engine" keynote renders, Arc's release pages, Linear's depth, Vercel's
gradient-mesh, MRI/tractography glow.

Five ingredients, all mandatory:
1. **A volumetric 3D centerpiece** that reads as *the Diwaan seal* from
   across the room.
2. **Layered morphism** — glass as the base language, neumorphic tactility
   on primary actions, one more accent morphism used sparingly.
3. **Ambient life** — the app is never visually dead: drifting particles,
   a breathing gradient mesh, subtle parallax, resting shimmer.
4. **Choreographed motion** — the vault transition and the
   blueprint-compiling moment are real sequences, not fades.
5. **Micro-interaction craft** — magnetic buttons, hover tilt, animated
   focus, count-up numbers, shimmer-on-load — everywhere a user touches.

---

## 2. The 3D centerpiece (`3d.json` + post-processing)

### 2.1 A real scene asset
Add `frontend/src/assets/seal.scene.json` — a **`THREE.ObjectLoader`-format
JSON scene** (`three/examples/jsm` has no loader needed beyond core
`THREE.ObjectLoader`). Two acceptable ways to produce it:
- **Recommended:** keep the procedural geometry generation you already
  have, build the scene once, then `scene.toJSON()` and commit the result
  as `seal.scene.json`. The component then *loads* it via `ObjectLoader`
  instead of rebuilding it every mount — the scene becomes data, cheaper
  to instantiate, and tweakable without touching code.
- **Or:** hand-author / export a richer seal from Blender as three.js
  `ObjectLoader` JSON. If you do, the asset is **CC0/CC-BY or
  self-authored**, credited in `frontend/CREDITS.md`, **< 1.5 MB**,
  geometry-only (no baked multi-MB textures — generate textures
  procedurally on a canvas at runtime).

The seal itself, upgraded: two hemispherical gold lattice shells (not just
two flat tori), a faceted core gem that refracts, a fine orbiting
particle field (200–400 points, additive), and a faint volumetric halo.
It must still say "seal / signet / imperial mark" at a glance.

### 2.2 Post-processing — this is what makes it look expensive
`EffectComposer` from `three/examples/jsm/postprocessing`:
`RenderPass → UnrealBloomPass` (strength ≈ 0.8, radius ≈ 0.5, threshold ≈
0 so only emissive blooms) `→` a small custom `ShaderPass` for grain +
vignette + ~0.5px chromatic aberration `→ OutputPass`.
`renderer.toneMapping = ACESFilmicToneMapping`, exposure ≈ 1.15,
`outputColorSpace = SRGBColorSpace`. Add a `RoomEnvironment` +
`PMREMGenerator` env map so the gold reads as real metal.

### 2.3 Scale it up and make it the moment
- `large` size renders at a genuinely large canvas (min 320×320, responsive
  up to ~480) and is the visual anchor of: the auth loading screen, the
  vault transition, and the onboarding "thinking / compiling blueprint"
  state.
- `state` prop drives intensity: `static` = slow bounded drift + resting
  shimmer; `generating` = visibly working (faster spin, bloom pulse, core
  gem strobing softly, particles agitated); `unlocking` = a distinct
  one-shot release — shells split, core flares, particles burst outward —
  timed to the vault door open.
- `small`/`micro` stay CSS rings. A full composer for a 24px avatar is
  waste and a perf risk — that split is deliberate, keep it.

### 2.4 Non-negotiable discipline (you already do most of this — keep it)
- `try/catch` around WebGL init and `webglcontextlost` → `onError` → CSS
  fallback. Both paths must render *something* that reads as the seal.
- `prefers-reduced-motion` → render one static frame, no RAF loop.
- Full teardown on unmount: dispose every geometry, material, texture,
  render target, **composer pass**, cancel the RAF, remove listeners.
  This component mounts/unmounts on every auth-load, every vault
  transition, every "thinking" state — a leak here compounds fast.
  **Deliver a DevTools memory-timeline screenshot across 10 mount/unmount
  cycles showing flat heap.**

---

## 3. Layered morphism — every surface, not just SpecShield

### 3.1 Glass as the base language, everywhere
Route **`AuthScreen`, `OnboardingChat`, the LandingPage hero card, the
SettingsModal, the ProjectNameModal, every dropdown/menu** through
`tokens.css` glass (`--glass-surface-*` + `--blur-*` + `--glass-border-*`
+ `--shadow-elevation-*`). No component keeps a flat
`background: #0a1628` rectangle. `AuthScreen.jsx` currently uses inline
styles — migrate it to the token vocabulary.
**Contrast guard:** every glass panel must hold body text at WCAG AA
against its *busiest* possible backdrop (the theme photo at full opacity
behind full blur) — verify per archetype theme, not just the default.

### 3.2 Neumorphic primary actions
`tokens.css` already has `--neumorph-primary-raised/hover/pressed`. Wire
them into every primary button (Sign In, Create Account, Create Session,
Upload, Launch DIWAAN, Save Changes) so interactive elements read as
physically pressable against the glass. Use it **only** on primary
actions — secondary/ghost buttons stay glass. One tactile language, used
with restraint.

### 3.3 One accent morphism
Pick one and use it sparingly for emphasis moments (the generated-dashboard
reveal, a HIGH-severity SpecShield mismatch banner, the decision card):
an **aurora-glass** treatment (animated conic-gradient sheen behind the
blur) or **claymorphism** on a single hero element. Document which and
where. Not everywhere — an accent.

---

## 4. Ambient life

- **Gradient-mesh / aurora background layer** behind (or replacing) the
  placeholder theme photos: 3–4 large blurred radial blobs in the active
  archetype's palette (`themes/archetypes.js` already defines
  per-archetype `primary/secondary/accent`), drifting on a slow loop
  (~30–40s), GPU-cheap (CSS `filter: blur()` on absolutely-positioned
  divs, or a single fragment shader on a full-screen quad). The theme
  photo, if kept at all, sits at low opacity above it.
- **Particle drift** — a thin field of slow motes over the whole app
  (canvas 2D or a tiny points shader), tinted by theme, ~40 particles,
  parallaxing subtly with pointer position.
- **Cursor spotlight** — a soft radial glow that follows the pointer at
  low opacity on the hero and SpecShield workspace. Disabled on touch.
- **Resting shimmer** — dormant stat tiles, the seal, idle cards breathe
  (opacity + ≤3% scale, per-element phase offset).
- **All of §4 disabled under `prefers-reduced-motion`** — surfaces still
  render (they carry information), nothing moves.

---

## 5. Choreographed motion

- **Vault transition (`App.jsx`):** the doors, the seal `unlocking`
  one-shot, and the crossfade to the new view are one timed sequence
  (~800ms, `--ease-vault`) — not three independent effects. The seal is
  the centerpiece of it.
- **Blueprint-compiling state:** the current "Compiling Blueprint
  Parameters…" text becomes a real moment — the `generating` seal at
  `large`, a progress shimmer, then a staggered reveal of the dashboard
  widgets (each card fades+rises with ~60ms stagger) using the accent
  morphism from §3.3 on the first card.
- **View/route changes** (auth → specshield → diwaan, and back): a
  consistent directional slide+fade, not an instant swap.
- **Scroll-reveal + parallax** on the LandingPage hero: title, seal, and
  chat enter on a short reveal; the background mesh parallaxes against
  scroll.
- Use CSS transitions / the Web Animations API. **No `framer-motion`
  anywhere near routing** (it has hung navigation on this React version
  before). One tiny stagger helper is fine; no heavy timeline library.

---

## 6. Micro-interaction craft

- **Magnetic buttons** — primary buttons nudge ~4px toward the pointer on
  near-hover, spring back on leave (disabled on touch / reduced-motion).
- **Card hover tilt** — SpecShield panels, sample-dashboard cards, the
  decision card get a subtle 3D tilt toward the pointer (≤6°, perspective
  ~800px).
- **Animated focus** — `:focus-visible` already uses `--focus-ring-gold`;
  make it *animate in* (ring scales from 1.5→1 over 120ms). Keyboard
  focus must be *more* visible after this pass, not less.
- **Count-up numbers** — SpecShield's AUDIT SUMMARY tiles (docs / errors /
  warnings / params-ok) count up from 0 when they change. Real values
  only (from `documents`/`comparisons`) — never animate a fake number.
- **Shimmer skeletons** — replace bare "loading…" text (dashboard fetch,
  session list, task polling) with token-styled shimmer skeletons.
- **Send-answer feedback** — the onboarding "Send" gives a press ripple
  and the new bubble rises in.

---

## 7. Fix the live UX bug this pass must not ship around

**`frontend/src/components/OnboardingChat.jsx` — auto-scroll bleeds the
chat panel over the hero.** Observed live: when a new message arrives,
`messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` scrolls
the **page**, not the chat, pulling the chat's dark panel up over the
hero header so a black band covers the top of the viewport until the user
scrolls back.
**Fix:** the chat history must be its own scroll container —
`overflow-y: auto` + a bounded `max-height` — and auto-scroll must target
*that element's* `scrollTop`, never `scrollIntoView` on the page. The
hero header stays put when a message lands. Add a visual test / manual
check: send an answer, assert the hero title is still in view.

---

## 8. Carryover functional debt (not visual, but "superiorly functional" means fixing it)

- **`backend/core/config.py` / `.env` — `GEMINI_MODEL=gemini-1.5-flash` is
  a dead model.** Confirmed live: the Gemini API 404s on it and on
  `gemini-2.5-flash` for this key, and directs callers to
  `gemini-3.6-flash`. Update the default and `.env.example`, and make the
  LLM service surface a clear error if the configured model 404s rather
  than hanging the onboarding "thinking" state forever.
- **`render.yaml` sets `CORS_ORIGINS: "*"`** on the deployed API — tighten
  to the real deployed frontend origin.
- The `google-generativeai` package prints an end-of-life warning on
  every boot. Migrating to `google-genai` is out of scope for this pass,
  but note it in delivery notes as the next infra task.

---

## 9. Hard constraints (violating any of these fails the pass)

- **Do not regress anything from the five prior passes.** Specifically,
  still true after this pass, verified by the existing test suites staying
  green:
  - JWT payloads decode via `frontend/src/api/client.js`'s
    `decodeJwtPayload` (base64url), never raw `atob`.
  - `pending_session_id` survives a 401 — including a 401 *during the
    resume-check GET itself* (`LandingPage.jsx` init).
  - `visual_theme` round-trips through **both** `GET
    /api/onboarding/sessions/{id}` and `GET /api/dashboards/{tenant_id}`.
  - SpecShield poll timers are stored and cleared on unmount, ticks are
    overlap-guarded, near-simultaneous completions debounce into one
    `refreshSession`.
  - Every authenticated fetch in every component goes through the shared
    `apiFetch` (which handles 401 globally) — no component hand-rolls
    fetch+auth+401 again, SpecShield included.
  - `backend/db/types.py` is the single `JSONType`/`UUIDType` source;
    `backend/models/__init__.py` imports every model; the
    registry-parity test still passes.
- **Never bypass `services/llm.py`'s validate-then-retry-once contract.**
- **No fabricated data in any surface** — including every animated
  number, meter, or "wow" stat. Absent data → honest `—` / skeleton /
  empty state.
- **Tenant isolation stays absolute** — every query filters by
  `current_user.tenant_id`.
- **No new dependencies** beyond `three` + its bundled `examples/jsm`
  addons. No `@react-three/*`, no `postprocessing` npm package (use
  `examples/jsm/postprocessing`), no `framer-motion`, no GSAP, no CDN
  scripts.
- **Performance floor:** 60 fps sustained with the heaviest screen open
  (LandingPage: mesh + particles + `large` seal + composer) under Chrome
  DevTools **4× CPU throttle** — measure and paste the result. Any single
  effect that can't hold that budget is cut, not shipped degraded.
- **Every WebGL/canvas surface** has: a non-WebGL fallback, full
  disposal on unmount, `prefers-reduced-motion` respect, and
  `webglcontextlost` handling.
- **No functional path may be blocked by more than one frame by any
  effect** — login, register, send-answer, upload, create-session,
  launch, settings-save, sign-out, session-switch. The vault transition's
  ~800ms is the single allowed exception and it's already there.
- Any asset added to the repo: self-authored or CC0/CC-BY, credited in
  `frontend/CREDITS.md`, < 1.5 MB.

---

## 10. Acceptance checklist

- [ ] `seal.scene.json` exists (ObjectLoader format), the seal loads it
      rather than rebuilding geometry each mount, source/licence documented.
- [ ] `EffectComposer` bloom + grain/vignette/CA + ACES tone mapping +
      env map on the seal; it reads as a volumetric centerpiece at `large`.
- [ ] `static`/`generating`/`unlocking` are visually distinct; `unlocking`
      is a real one-shot synced to the vault doors.
- [ ] Seal WebGL-fail and context-loss both fall back to a CSS seal that
      still reads as the mark. Reduced-motion renders it static.
- [ ] Flat-heap DevTools memory timeline across 10 seal mount/unmount
      cycles — pasted in delivery notes.
- [ ] `AuthScreen`, `OnboardingChat`, the hero card, both modals all use
      `tokens.css` glass — no flat dark rectangles left. AA contrast
      verified per archetype theme.
- [ ] Neumorphic treatment on every primary action, glass on secondaries,
      one documented accent morphism used sparingly.
- [ ] Animated gradient-mesh background + particle drift + cursor
      spotlight + resting shimmer — all disabled under reduced-motion,
      all within the 4× CPU 60fps budget (measured, pasted).
- [ ] Vault transition and blueprint-compiling state are choreographed
      sequences with staggered widget reveal; view changes slide+fade
      consistently.
- [ ] Magnetic buttons, card hover-tilt, animated focus-in, count-up on
      real SpecShield stats, shimmer skeletons replacing "loading…" text.
- [ ] OnboardingChat scrolls inside its own container; a new message
      never pushes the chat panel over the hero header (checked).
- [ ] `GEMINI_MODEL` default updated off the dead `gemini-1.5-flash`; the
      LLM service fails loudly on a 404 model instead of hanging.
- [ ] `render.yaml` CORS tightened off `"*"`.
- [ ] Existing `pytest` and `npm test` (Vitest) suites both fully green.
- [ ] Delivery notes include: the 4× CPU fps measurement, the seal
      memory-timeline, and before/after screenshots of every screen
      touched.
