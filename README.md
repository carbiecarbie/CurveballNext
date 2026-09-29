# CurveballNext

Independent implementation project for the 2002 Flash game Curveball, guided by the behavioral research in `docs/`.

## Project status

M1 is a playable, independent offline rally laboratory. The simulation uses recovered discrete equations at 30 Hz and the explicit `m1-provisional-01` compatibility profile. **Native Flash parity remains unverified.** M0 and M0.5 findings have not changed.

The implementation candidate passes 62 deterministic tests, type checking, a locked production build, and automated Edge smoke checks. Required manual play/feel checks and Firefox smoke remain pending: **M1 is not yet accepted**. See [acceptance evidence](docs/m1-acceptance.md), [compatibility assumptions](docs/compatibility-assumptions.md), and the [M1 plan](docs/milestones/m1-faithful-offline-prototype.md).

## Run locally

Use Node 22.12+ in the 22 line, Node 24, or Node 26+. Tested on Windows with **Node 24.21.0 and npm 11.19.0**. Direct development dependencies are pinned: TypeScript 7.0.2, Vite 8.3.1, Vitest 5.0.2, and @types/node 26.6.3.

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Open the printed loopback URL (normally `http://127.0.0.1:4173`). Development: `npm run dev`. Test watch: `npm run test:watch`. Stop local servers before `npm ci` on Windows so their loaded native dependencies are not locked.

For this machine, the standalone Node distribution including npm was installed **outside the repository**. To use it in a fresh PowerShell session:

```powershell
$env:PATH = 'C:\Users\carbo\AppData\Local\CurveballNextToolchain\node-v24.21.0-win-x64;' + $env:PATH
node --version
npm.cmd --version
```

Use `npm.cmd` if PowerShell policy prevents the `npm.ps1` shim. No npm package or toolchain payload is a project dependency. The repository package/lock files exist solely for M1 development dependencies.

After installation and build, the production preview can be played and reloaded with external networking disabled. Loopback HTTP must remain available. `file://`, a PWA, and an executable package are outside M1. Vite preview is a local verification tool.

## Controls and observation

- Move the primary mouse pointer to ease the near paddle toward it. Movement outside the court still supplies a target while the window is focused; the paddle itself clamps.
- Press the primary mouse button inside the court while the installed paddle and ball boxes overlap to serve. Holding or releasing does not serve. Fresh balls need their first ordinary tick before serving.
- **Retry rally** / `R` replaces the ball and retains the paddles. Misses hold for 19 ticks before automatic retry. **Reset trial** or selecting a difficulty centers everything and clears trial diagnostics. All ten recovered difficulty tuples are available.
- **Pause** / `Escape` suspends; **Resume** is separate from serving. Blur, hidden tabs, or more than five overdue ticks suspend automatically. Pending mouse inputs are discarded. Resume accepts the latest pointer target through ordinary easing. **Step one tick** works only while paused.
- Reference view has no interpolation. Smooth view is explicitly delayed interpolation and snaps at collisions/serves/resets. Native view uses a 350 × 250 CSS stage. Device pixel ratio changes drawing resolution only.
- **Debug** shows state, publication/cache stamps, actual ball-handler checkpoints and tested boxes. **Export** downloads the last 600 tick records with their preceding authoritative checkpoint and final state. Counters/classifications are diagnostics, not original score/lives.

`src/debug/replay.ts` is a DOM-free strict replay function. The test suite exercises JSON round trips, invalid captures, and ring truncation. Browser captures from this candidate replay exactly in the same Edge engine. Node and Edge differed by approximately 5e-15 in a transcendental projection result; strict cross-engine replay rejects that discrepancy. Cross-engine bit identity is not promised; no tolerance is added to gameplay inequalities or strict replay.

## Scope and architecture

Core/compat modules own logical state, installed collision boxes, cache/publication provenance and lifecycle. `tick` clones its input and returns a new state, events and actual observations. The host maps timestamps to fixed tick boundaries; Canvas consumes snapshots. There is no variable-delta physics, prediction, random AI, generic collision solver, scoring, lives, campaign, application backend or external runtime asset.

Visuals are newly drawn Canvas geometry with system fonts. There is no original artwork, sound or executable content. Future compatibility changes require a new profile and reviewed fixtures rather than silent tuning. The original research remains authoritative for recovered behavior.

## Local reference material

Original/reference files belong in `reference-local/`. This directory is excluded from Git. Consult the original SWF only when a task specifically requires runtime or reference verification; use the behavioral specification as the implementation source of truth.
