# M3 — Complete Original Offline Presentation

**Status:** completed, accepted and closed by the maintainer on 30 September 2026, including physical visual/audio review. **Created:** 29 September 2026; **revised and accepted:** 30 September 2026 (America/Sao_Paulo). **Historical baseline:** clean `main` at accepted M2 `103193cfc0b7642dc2d1d795fd34ddffce913abc`. Initial working tree and index were empty; 159 tests, typecheck and production build passed. The maintainer revision preserved the existing local M3 implementation. At closure, implementation and documentation remain uncommitted on `main` at that accepted M2 HEAD; the index is empty. Acceptance authorizes milestone closure, not a commit or push. `reference-local/` remains ignored and untracked.

## Presentation implemented

Independent retro arcade presentation against near-black backgrounds, using system typography and procedural Canvas geometry. The revised palette assigns dark red/red-orange to the court, warm white/amber to the orb, cyan/blue to the player paddle, green to the enemy paddle, and cyan to the HUD/UI. The supplied neon reference informed color separation only; no layout or asset was copied. The minimal HUD places score/level/level bonus above the court and player/enemy lives below it. Title/New Game, the existing timed level transition, pause/resume, Game Over/restart, and level-10 content completion share the same visual language. The title is host-only and advances no simulation ticks until New Game. It adds no initial gameplay delay. Terminal result screens remain visible after host focus suspension.

Accepted player serve/return events drive one fixed HUD notice: `ACCURACY BONUS`, `CURVE BONUS`, or `SUPER CURVE BONUS`. Curve replaces accuracy when both qualify, following the recovered contact award order; qualifying zero-value buckets still produce a label. No scoring calculation or new core event was added. Notices last 36 active ticks, fading over the last eight; pause hides and freezes them, and misses/retry/reset/transitions clear them. This restrained treatment and its duration are newly authored presentation, not verified original animation timing.

The energy orb has a translucent shell, a bright core, and internal plasma paths clipped inside its silhouette. Speed and curve magnitude increase internal activity; curve direction biases the paths; completed wall/paddle events briefly intensify the material. Far-depth rendering uses fewer internal paths and a minimum visible rim width. There are no outward electric rays, particles, ball trails, floating score text, or large screen flashes.

Both paddles retain their projected rectangular silhouettes, with translucent glass, restrained metal edge accents, and short contact response. Court depth slices, fixed wall segments, ambient light and quiet side hexagons react to the ball's current position and motion. No path history is retained. Title/transition/result backdrops show the court without gameplay objects obscuring copy.

Debug/testing is collapsed by default. Its explicit enable control retains level selection, forced misses, retry/`R`, paused Step, diagnostics/state/audits, collision boxes and local export. Native-size and delayed smooth views remain available. Export filenames identify M3 while retaining `curveball-m2-trace-2` unchanged.

**Audio included:** independently synthesized Web Audio impacts for serve, both paddles, walls, miss, level transition, Game Over and completion. The revision uses fast attacks and short inharmonic partials for a metallic/electronic arcade character, with distinct player/enemy pitches and quieter wall contacts. This is a new approximation of the requested style, not recovered original waveforms. Modest gain, a 24-oscillator cap including scheduled partials, explicit mute/unmute, cancellation on pause/restart, and graceful unavailable-audio handling remain. Context creation/resume follows user action; asynchronous audio work never gates simulation. No original sound payload or downloaded audio is used.

**Local score persistence deferred:** visual presentation and flow are the milestone priority. There is no storage/save subsystem, local score table, online ranking reconstruction or network dependency.

## Gameplay preservation

No core, compatibility, scheduler/input, trace/replay, difficulty, package or Vite configuration file changed. All authoritative state still comes from the accepted `tick` transition at 30 Hz. UI commands retain accepted New Game/serve/retry/miss paths. Cosmetic feedback remembers event tick numbers outside snapshots; interpolation, lighting and audio never write installed boxes, caches, score or lifecycle state. Existing scoring, 19-tick miss resolution, 45-tick level transition and level-10 containment remain intact. No replay schema extension was needed.

Presentation tests cover frozen snapshot rendering in all six phases, screen precedence and transition timing, bounded event pulses/notices, zero-value bonus qualification, activity observation, bounded/muted/failed audio and exact replay after presentation observation. The existing renderer test's Canvas mock was extended to support gradient objects; its immutability assertions remain intact.

## Validation and review

Initial implementation evidence, before the maintainer revision:

- **173 tests in seven files pass**, including existing mathematical, lifecycle, deterministic replay and synthetic 15/30/60/120/144 Hz cadence/jitter tests. Explicit typecheck and production build pass. `git diff --check` passes after correcting a trailing blank line. Reviewed tracked diff and all new modules/tests.
- Production smoke in installed **Edge 154.0.4258.37**, with external requests blocked: title waits at tick 0; New Game; invalid/accepted serve; normal play at levels 1/5/10; pause/Step/resume; focus suspension; five misses to Game Over/restart; enemy depletion/bonus/level intro (including pause/resume); level-10 completion/restart; native/smooth views; debug toggle/retry/fixtures/export; sound mute/unmute; offline reload. **No page/console errors and no external request attempts.** Depletion fixtures are labeled debug actions, not human campaign victories.
- An exported **382-record** production capture replayed exactly in the same Edge engine, including state/events/audits. The previously recorded cross-engine transcendental precision limitation remains; no formula or comparison tolerance was changed.
- Browser audio analysis confirmed a nonzero, bounded synthesized signal (observed peak about 0.056), zero active voices after mute, and no new voices for muted cues. This is signal verification, not human listening assessment.
- Agent visual inspection of title, active court/orb/paddles, pause, Game Over, level transition, completion, and compact desktop screenshots. A separate frozen-fixture atlas verified calm and energized silhouettes at near/middle/far depth at native 350 × 250 size without touching live game state. Local smoke scripts, screenshots, capture and machine-readable evidence are ignored under `captures-local/m3-*`.
- Source/module graph and static `dist/` reviewed: only independent HTML/CSS/JS, no original assets or external runtime service. Development reference URL returns 403; production reference URL returns only the SPA HTML fallback. Private reference bytes were not opened. Historical research remains intact.

Shell sandbox process setup failed; authorized read/edit/validation commands used reviewed escalation and the existing Node 24.21.0/npm toolchain. A development-server Windows file-watcher lock on an ignored capture interrupted one supplemental attempt; restart completed replay/reference checks. No tooling dependency was added. Firefox's expected Playwright executable is absent; optional Firefox smoke was unavailable.

### Maintainer revision validation — 30 September 2026

- **188 tests in seven files pass**, including deterministic replay and frozen-state presentation checks. Typecheck, production build and `git diff --check` pass. Reviewed the revision against a copy of the starting working tree; core/compatibility/runtime/trace/configuration files are unchanged.
- Installed Edge production smoke passed regular play, pause/resume, transitions, Game Over/restart, completion/restart, debug tools, mute/unmute and offline reload, with no page/console errors or external request attempts. All three bonus notices appeared from qualifying real mouse serves; fixed HUD bounds, stable canvas geometry, pause hiding/freezing and expiry were checked. A browser with deliberately unavailable audio still entered Rally normally. An independently drawn inline orb favicon resolves the browser's missing-icon request.
- The final **380-record** production trace replayed exactly in the same Edge engine. Synthesized audio produced a bounded nonzero signal (observed peak about 0.085); mute left zero active voices and muted cues scheduled none. Maintainer listening approval is recorded separately below.
- Visually inspected revised court/paddle/orb separation, HUD notices and result screens, plus calm/energized near/middle/far frozen fixtures at native size. Revision evidence is ignored under `captures-local/m3-revision-*`. Reference access still returns development 403 / production HTML fallback; build output contains only independent HTML/CSS/JS. Firefox remains unavailable.

## Acceptance and closure — 30 September 2026

The maintainer reports completing the missing physical review and approves the final revised M3 visuals and synthesized audio. This supplies the human visual/listening acceptance in addition to the automated browser and signal evidence above. M3 is completed and accepted within its offline presentation scope, including the documented deferral of local score persistence.

Closure changed only README and this milestone document. The complete tracked diff and new modules/tests were reviewed; no closure-blocking defect was found. Final closure gates pass: **188 tests in seven files**, explicit typecheck, production build and `git diff --check`. Gameplay and presentation source files, tests, dependencies and configuration remain unchanged from the approved revision. The full M3 implementation and documentation are ready for a maintainer-authorized commit; no files were staged, committed or pushed during closure.

## Remaining uncertainty

Native U01–U05, original scoring runtime verification, original post-level-10 behavior and exact original audiovisual timing remain unverified. The previously recorded cross-engine transcendental precision limitation also remains. Maintainer presentation acceptance does not resolve these historical questions. M3 does not reopen SWF investigation, close M0.5, freeze Simulation Contract v1 or claim native Flash parity. The completion wording continues to identify the CurveballNext containment policy.
