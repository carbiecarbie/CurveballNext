# CurveballNext

Independent implementation project for the 2002 Flash game Curveball, guided by the behavioral research in `docs/`.

The current priority is faithful reconstruction of the original game's behavior. Expansions and rebalancing come after that work.

## Project status

M1 was accepted at `59cdbb9e3f232cf07a24c6c304ac43c851a64db4` after 105 tests, typecheck, build, deterministic replay, and Edge smoke. The subsequent documentation cleanup at `d4a61a9049545110a235e6dacb6e73c8c7183d4a` is the M2 baseline. The implementation uses recovered discrete equations at 30 Hz and the explicit `m1-provisional-01` compatibility profile. **Native Flash parity remains unverified.** M0 and M0.5 findings have not changed.

M2 adds the complete offline single-player loop: lives, depleting score buckets, level time bonus, ten recovered difficulty entries, automatic progression, game over, and restart. The level-10 ending is an explicit CurveballNext containment policy because the original has no verified final-victory branch. M2 remains a candidate pending maintainer review. See [M2 implementation and validation](docs/milestones/m2-complete-single-player-loop.md), [M1 acceptance](docs/m1-acceptance.md), and [compatibility assumptions](docs/compatibility-assumptions.md).

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
- **New Game** starts at level 1 with score 0, five player lives and three enemy lives. A player miss costs one life; an enemy miss costs one enemy life. Defeat three enemy lives to advance. Player lives carry forward.
- The HUD shows Score, Level, Player Lives, Enemy Lives and the remaining Level Bonus. Game Over and completion after the defined level-10 data offer New Game.
- **Debug state & collision boxes** reveals developer testing controls. The selector starts directly at any recovered level 1–10. Debug retry (`R`) and forced misses exercise transitions without changing the normal campaign rules.
- **Pause** / `Escape` suspends play; use **Resume** to continue. The game also pauses when the tab loses focus or timing falls behind. **Step one tick** is available while paused.
- Toggle the reference or smooth view, use Debug to inspect state, and Export to save a local M2 trace. M1 return/miss counters remain diagnostics; the HUD holds authoritative score and lives.

Trace and replay behavior, browser evidence, and cross-engine limitations are recorded in [M1 acceptance evidence](docs/m1-acceptance.md).

## Scope and architecture

The deterministic core owns the 30 Hz rally and campaign simulation; the browser host handles input and timing, and Canvas draws the state. There is no application backend or external runtime asset. M2 captures use `curveball-m2-trace-2`; old M1 captures are intentionally rejected. Detailed rules and implementation assumptions are in `docs/`.

Visuals are newly drawn Canvas geometry with system fonts. There is no original artwork, sound or executable content. The original research remains authoritative for recovered behavior.

## Local reference material

Original SWF, art, audio, and executable assets are not distributed in this repository. Private reference files belong in `reference-local/`, which is excluded from Git. Consult the original SWF only when a task specifically requires runtime or reference verification; use the behavioral specification as the implementation source of truth.
