# CurveballNext

Independent implementation project for the 2002 Flash game Curveball, guided by the behavioral research in `docs/`.

The current priority is faithful reconstruction of the original game's behavior. Expansions and rebalancing come after that work.

## Project status

M1 is a playable, independent offline rally laboratory. The simulation uses recovered discrete equations at 30 Hz and the explicit `m1-provisional-01` compatibility profile. **Native Flash parity remains unverified.** M0 and M0.5 findings have not changed.

The recorded M1 checks include deterministic tests, type checking, a production build, and automated Edge smoke checks. Required manual play/feel checks and Firefox smoke remain pending: **M1 is not yet accepted**. See [acceptance evidence](docs/m1-acceptance.md), [compatibility assumptions](docs/compatibility-assumptions.md), and the [M1 plan](docs/milestones/m1-faithful-offline-prototype.md).

## Run locally

Install a Node version supported by `package.json` (Node 22.12+ in the 22 line, Node 24, or Node 26+) so `node` and `npm` are available on your PATH. Run these commands from the repository root:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Open the printed loopback URL (normally `http://127.0.0.1:4173`). Development: `npm run dev`. Test watch: `npm run test:watch`. Stop local servers before `npm ci` on Windows so their loaded native dependencies are not locked.

Use `npm.cmd` if PowerShell policy prevents the `npm.ps1` shim. Development dependencies are pinned in `package.json` and `package-lock.json`; the local Node installation is outside the repository.

After installation and build, the production preview can be played and reloaded with external networking disabled. Loopback HTTP must remain available. `file://`, a PWA, and an executable package are outside M1. Vite preview is a local verification tool.

## Controls and observation

- Move the primary mouse pointer to ease the near paddle toward it. Movement outside the court still supplies a target while the window is focused; the paddle itself clamps.
- Press the primary mouse button inside the court while the paddle and ball overlap to serve. Holding or releasing does not serve.
- **Retry rally** / `R` starts another rally. **Reset trial** or the difficulty selector starts a fresh trial. All ten recovered difficulty settings are available.
- **Pause** / `Escape` suspends play; use **Resume** to continue. The game also pauses when the tab loses focus or timing falls behind. **Step one tick** is available while paused.
- Toggle the reference or smooth view, use **Debug** to inspect state, and **Export** to save a local trace. Counters and classifications are diagnostics, not original score or lives.

Trace and replay behavior, browser evidence, and cross-engine limitations are recorded in [M1 acceptance evidence](docs/m1-acceptance.md).

## Scope and architecture

The deterministic core owns the 30 Hz rally simulation; the browser host handles input and timing, and Canvas draws the state. M1 does not include scoring, lives, campaign progression, an application backend, or external runtime assets. Detailed rules and implementation assumptions are in `docs/`.

Visuals are newly drawn Canvas geometry with system fonts. There is no original artwork, sound or executable content. The original research remains authoritative for recovered behavior.

## Local reference material

Original SWF, art, audio, and executable assets are not distributed in this repository. Private reference files belong in `reference-local/`, which is excluded from Git. Consult the original SWF only when a task specifically requires runtime or reference verification; use the behavioral specification as the implementation source of truth.
