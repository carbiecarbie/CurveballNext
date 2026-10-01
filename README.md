# CurveballNext

Independent implementation project for the 2002 Flash game Curveball, guided by the behavioral research in `docs/`.

The current priority is faithful reconstruction of the original game's behavior. Expansions and rebalancing come after that work.

## Project status

M1 was accepted at `59cdbb9e3f232cf07a24c6c304ac43c851a64db4` after 105 tests, typecheck, build, deterministic replay, and Edge smoke. The subsequent documentation cleanup at `d4a61a9049545110a235e6dacb6e73c8c7183d4a` is the M2 baseline. M1 used recovered discrete equations at 30 Hz and the `m1-provisional-01` compatibility profile. The accepted M4 implementation uses `m4-ruffle-06-01`. **Native Flash parity remains unverified.** M0 and M0.5 findings have not changed.

M2 is accepted and closed at `103193cfc0b7642dc2d1d795fd34ddffce913abc` (`Implement M2 complete single-player loop`). It supplies lives, depleting score buckets, level time bonus, ten recovered difficulty entries, progression, Game Over, and restart. The level-10 ending remains an explicit CurveballNext containment policy because the original has no verified final-victory branch.

M3 is **completed and accepted**, including maintainer physical visual/audio approval on 30 September 2026. Its independent neon presentation separates a red/orange court and warm plasma orb from cyan/blue player and green enemy glass-and-metal paddles, with cyan UI. It includes reactive court lighting, minimal arcade HUD, restrained bonus notices, consistent title/pause/transition/result screens, collapsed debug tools, and optional synthesized metallic arcade impacts. Gameplay and the M2 replay schema are unchanged. Local score persistence is deferred. See [M3 implementation, validation and acceptance](docs/milestones/m3-complete-original-offline-presentation.md), [M2 historical implementation evidence](docs/milestones/m2-complete-single-player-loop.md), [M1 acceptance](docs/m1-acceptance.md), and [compatibility assumptions](docs/compatibility-assumptions.md).

M4 is **completed, accepted and closed** after independent review on 30 September 2026. CurveballNext matches the pinned Ruffle v0.6.0 runtime oracle at `cac5c99ce4a17e606f4ee3090389bb878f852055` for the verified/tested original-runtime behavior, except documented intentional containment and explicitly retained uncertainties. Independent review reran all 63 sessions (5,371 complete frames; 192,372 observations), confirmed exact derived repeats and 759 MATCH comparison components, and passed the final validation gates. Callback/cache order, independent logical/display coordinates, native bounds and measured rewind retention/readiness match; the moving-input serve scores 100 in both. R12 level-10 containment remains intentional. **Historical Adobe Flash Player equivalence remains unproven.** Natural post-level-10 play, early/stopped-miss clicks, arbitrary asynchronous desktop input, exact audiovisual timing and historical online services remain unverified. The blocked attempt and investigation evidence remain historical. See [M4 evidence, limits and independent closure review](docs/milestones/m4-original-runtime-parity-closure.md#final-independent-review-and-closure).

M5 private online multiplayer is an **unaccepted implementation candidate**. The accepted contract remains [the M5 plan](docs/milestones/m5-private-online-multiplayer-plan.md). See [candidate evidence and blockers](docs/milestones/m5-implementation-candidate.md), [local/deployment runbook](docs/m5-runbook.md), and [two-computer acceptance guide](docs/m5-physical-acceptance.md). No online hosting has been provisioned or deployed.

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

Choose Classic at the entry screen for the accepted offline campaign. Choose Online for a private two-player room; start the separate backend as described in the M5 runbook.

## Classic controls and observation

- Move the primary mouse pointer to ease the near paddle toward it. Movement outside the court still supplies a target while the window is focused; the paddle itself clamps.
- Press the primary mouse button inside the court while the paddle and ball overlap to serve. Holding or releasing does not serve.
- The title screen waits for **New Game**, which starts at level 1 with score 0, five player lives and three enemy lives. A player miss costs one life; an enemy miss costs one enemy life. Defeat three enemy lives to advance. Player lives carry forward.
- The HUD shows Score, Level, Player Lives, Enemy Lives and the remaining Level Bonus. Game Over and completion after the defined level-10 data offer New Game.
- Qualifying player serves/returns show **ACCURACY BONUS**, **CURVE BONUS**, or **SUPER CURVE BONUS** briefly in one fixed HUD slot. Curve takes precedence when both qualify. These labels observe existing events and do not add points or change rules.
- Open **Debug / testing** and enable debug controls to inspect state and collision boxes. The selector starts directly at any recovered level 1–10. Debug retry (`R`) and forced misses exercise transitions without changing the normal campaign rules.
- **Pause** / `Escape` suspends play; use **Resume** to continue. The game also pauses when the tab loses focus or timing falls behind. Debug **Step one tick** is available while paused after starting.
- **Sound on/off** mutes the optional, independently synthesized event sounds. Audio initializes on a user action; unavailable browser audio leaves play functional. There is no music or downloaded sound asset.
- Debug / testing also contains native-size and delayed smooth views and **Export last 600 ticks**. M3 exports retain the M2 trace schema. Return/miss counters remain diagnostics; the HUD holds authoritative score and lives.

Trace and replay behavior, browser evidence, and cross-engine limitations are recorded in [M1 acceptance evidence](docs/m1-acceptance.md).

## Scope and architecture

The deterministic Classic core owns the 30 Hz rally and campaign simulation; the browser host handles input and timing, and Canvas draws the state. Classic has no backend dependency or external runtime asset. Online uses a separate authoritative Node/TypeScript process with bounded in-memory rooms. Classic captures retain `curveball-m2-trace-2`; the M4 profile and actor availability fields reject old `m1-provisional-01` captures because deterministic scheduling/display semantics changed. Detailed rules and implementation assumptions are in `docs/`.

Visuals are newly drawn Canvas geometry with system fonts; sound uses newly authored Web Audio oscillator envelopes. There is no original artwork, sound, font or executable content. Presentation observes snapshots/events and never writes simulation state. The original research remains authoritative for recovered behavior. No local score table or historical online ranking flow is implemented.

## Local reference material

Original SWF, art, audio, and executable assets are not distributed in this repository. Private reference files belong in `reference-local/`, which is excluded from Git. Consult the original SWF only when a task specifically requires runtime or reference verification; use the behavioral specification as the implementation source of truth.
