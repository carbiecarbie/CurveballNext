# M1 implementation candidate — evidence and remaining acceptance

Date: 29 September 2026. **Status at time of evidence: implementation candidate; M1 acceptance pending.** This historical record describes the uncommitted candidate before the M1 implementation commit. It is independent prototype evidence, not Flash/Ruffle runtime verification. The historical M0/M0.5 documents are unchanged.

## Baseline and tools

- Verified branch `main`, HEAD `862cece771dc73d176888b9af4ffb76c04c7bad7`, initially clean working tree and empty index. No tracked reference-local files; its ignore rule was active.
- Candidate is the uncommitted working tree based on that commit; no candidate commit exists. Nothing was staged, committed, pushed or publicly deployed.
- Node **24.21.0**, npm **11.19.0**. Official Windows x64 distribution installed locally outside the repository. Downloaded ZIP SHA-256: `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`, checked against the official Node manifest.
- Reconfirmed versions and clean working tree before creating any M1 package files. npm itself is not a project dependency. No toolchain payload was placed in the repository.
- Pinned dev dependencies: TypeScript **7.0.2**, Vite **8.3.1**, Vitest **5.0.2**, @types/node **26.6.3**. Node requirements and Vite peer compatibility were checked against registry metadata; package-lock records exact resolution.

## Automated gates

| Operation | Actual outcome |
|---|---|
| `npm ci` | PASS; 39 packages, zero reported audit vulnerabilities. Servers must be stopped first on Windows; an initial attempt encountered an in-use Rolldown native module. Retried successfully after stopping them. |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 62 tests, 3 files, no skips |
| `npm run build` | PASS: 20 transformed modules; static HTML, CSS and JS |
| `git diff --check` | PASS (normal local LF/CRLF warnings only) |

`tests/core.test.ts` covers T01–T13 mathematical and provisional compatibility cases: complete difficulty data, easing/clamps, curve signs/floors, closed-form integration, all walls and corner precedence, strict planes, projection, AI sample age, classifications, near/far old-box separation in both directions, cache/command ordering and lifecycle retention.

`tests/runtime.test.ts` covers T12/T14 timestamp boundaries, coalesced samples, duplicate/held presses, late/out-of-order delivery, no future-input catch-up, pause/overrun/step, mapping, DPR/render immutability, replay rejection and 600-record retention. Synthetic 15/30/60/120/144 Hz streams, including bounded jitter, each produce 300 updates in ten active seconds and identical core states/events for the canonical log.

`tests/scenarios.test.ts` covers a deterministic synthetic initial flight with ordinary subsequent commands, multiple returns, walls, retries, and separate player/enemy misses with automatic retry and replay. Synthetic enemy-miss evidence is not a claim about human reachability.

## Browser evidence

The integrated browser tool failed before opening a tab (`trusted Node process exited unexpectedly`). Existing bundled Playwright was used from outside the project's dependencies. Browser scripts, screenshots, traces and machine-readable results are local, Git-ignored under `captures-local/`.

| Check | Evidence / limitation |
|---|---|
| B01 boot/build | PASS automated: production preview in installed Edge **154.0.4258.37**, visible court and controls; no page/console errors. Initial and debug screenshots visually inspected. |
| B02 serve/control | PASS automated: nonoverlapping press rejected; overlapping primary press serves; holding through a player miss/retry does not relaunch; release does not serve. Human mouse assessment pending. |
| B03 rallies | PASS automated: levels 1, 5 and 10 launched and rallied with scripted primary-mouse moves; trial return observations recorded. Human horizontal/vertical/diagonal curve/feel observations pending. |
| B04 miss/retry | PASS automated: scripted player miss recorded once while holding primary; automatic retry returns to waiting. Both sides and repeated retries additionally covered by analytical core scenarios. Enemy miss is synthetic, not human play. |
| B05 timing/view | PASS synthetic fixed-clock checks and automated native/enlarged/interpolation controls. Physical monitor refresh testing, real browser zoom and manual alignment assessment pending. |
| B06 focus/pause | PASS automated pause, one-step and resume without serve; synthetic blur event pauses. Actual window switching/document hiding still requires manual confirmation. |
| B07 offline/material | PASS automated: external requests blocked while loopback remained available; production boot/reload worked; no attempted external runtime requests. Dev reference URLs returned HTTP 403. Production reference URL returned only the SPA HTML fallback, not reference content. |
| B08 capture/Firefox | Edge exported an actual scripted-input capture and replayed it headlessly with exact same-engine state/event/audit equality. **Firefox pending:** Playwright Firefox 153.0 was downloaded to the user toolchain, but launch failed with `spawn UNKNOWN`; no Firefox gameplay result claimed. |

Final Edge capture: **402 ticks**, final tick **402**, exact same-engine replay match. The final level 1/5/10 observations recorded respectively 2/3/6 rally returns during the bounded scripted runs, followed by a separate player-miss/held-button scenario. Actual evidence files: `captures-local/browser-evidence.json`, `browser-capture.json`, `replay-evidence.json`, `production-initial.png`, `production-debug.png`; local scripts `browser-smoke.cjs` and `replay-edge.cjs`. These are new-prototype records only. Do not redistribute the private original reference with them.

### Cross-engine replay limitation

The first Edge capture replayed exactly in Edge. Strict replay under Node 24.21.0 found a projection width difference at tick 80: Node `7.499999961314591`, Edge `7.499999961314586` (difference `5.329070518200751e-15`). The production formula's arithmetic order was inspected and preserved. This is consistent with the plan's explicit lack of cross-engine transcendental bit-identity guarantees. Strict replay reports the first mismatching tick instead of silently accepting approximate geometry; no gameplay tolerance was added. Same-engine replay remains the verified workflow.

## Material and source review

Project boundaries were reread. Implementation was independently written from behavioral rules in the supplied plan and repository research. No SWF inspection, conversion, emulator or original-art extraction was performed. Canvas geometry, styles and interface are new; fonts are system fonts and no audio is included.

Reviewed core and compatibility modules, host input/clock, presentation, trace/replay, tests, package/config and untracked candidate files. Runtime module graph contains only independent TypeScript/CSS. `publicDir` is false. Vite retains strict filesystem access and default sensitive-file exclusions plus explicit reference/SWF denies. Both the repository-relative `/reference-local/curveball.swf` request and a direct `/@fs/` request to the same local reference file returned HTTP 403 in development.

Build output consists solely of generated `index.html` and two independent application assets. No original content is imported, loaded or bundled; the production request log has no reference asset or external dependency. The private original file was not opened to perform this audit. Research metadata and behavioral equations remain documentation, not executable/art assets.

## Remaining acceptance

No known mathematical or same-engine deterministic correctness defect remains from the executed checks. This is not a declaration that all required browser checks passed.

1. Run Firefox desktop boot/control/serve/retry in an environment where it can launch.
2. Record actual desktop window/tab focus transitions, zoom/alignment, available physical refresh behavior and manual play at 1/5/10.
3. Maintainer feel assessment: **not yet provided**. Record paddle response, visible curvature, readable depth, wall behavior and opponent responsiveness. Distinguish defects from compatibility assumptions and deferred presentation; do not tune recovered constants.

U01–U05 remain open and M0.5 remains incomplete. No original-runtime parity claim or frozen simulation contract is made. M1 can be marked accepted only after the remaining browser/manual evidence is recorded.
