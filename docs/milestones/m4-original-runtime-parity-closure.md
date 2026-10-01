# M4 — Original Runtime Parity Closure

**Final status:** **M4 COMPLETED AND ACCEPTED** after independent review on 30 September 2026. CurveballNext matches the pinned Ruffle v0.6.0 runtime oracle for the verified/tested original-runtime behavior, except documented intentional containment and explicitly retained uncertainties. U01–U05 are resolved within the measured scope; historical Adobe Flash Player equivalence remains unproven. The blocked attempt and first runtime pass below remain historical. See [final independent review and closure](#final-independent-review-and-closure).

## First attempt — preserved blocked history

The following failed-attempt record, including its baseline, validations and original Git handoff, is historical and preserved. The continuation begins after its original final status.

**Date:** 30 September 2026 (America/Sao_Paulo).

**Outcome:** **RUNTIME VERIFICATION BLOCKED**; no original gameplay observations.

**Original SWF executed:** **No**.

**Runtime oracle/version/commit/executable SHA-256:** **None / not available**.

**Contract:** `m1-provisional-01` remains provisional; Simulation Contract v1 is not frozen.

This is a fresh attempt after a previous Windows sandbox initialization failure that ran no commands and changed no files. This attempt's shell initialized successfully and performed the baseline gate before any writes. M1–M3 acceptance remains intact. No post-reconstruction feature work was started.

## Baseline gate

Workspace: `D:\Projetos\CurveballNext`.

| Check | Expected and observed | Result |
|---|---|---|
| Branch | `main` | PASS |
| HEAD | `ab3cea33ddbd62f6277888532b5fc571b702bf72` | PASS |
| Subject | `Complete M3 offline presentation` | PASS |
| Local `refs/remotes/origin/main` | `ab3cea33ddbd62f6277888532b5fc571b702bf72` | PASS |
| Starting index and tracked working tree | Empty index; no tracked changes | PASS |
| Starting non-ignored untracked files | None | PASS |

Commands: `git branch --show-current`, `git rev-parse HEAD`, `git log -1 --format=%s`, `git rev-parse refs/remotes/origin/main`, `git status --porcelain=v2 --untracked-files=all`, `git diff --cached --quiet`, and `git diff --quiet`. The remote-tracking ref was checked locally; no fetch was performed. Ignored reference, dependencies, build output and previous local captures already existed.

## Reference identity

The private reference is `reference-local/curveball.swf`, confirmed ignored by `git check-ignore`. Read-only header decoding and SHA-256 verification passed before runtime acquisition was attempted. The reusable helper independently repeated the gate:

```powershell
node tools/m4/verify-reference.mjs reference-local/curveball.swf
```

| Property | Observed | Result |
|---|---|---|
| SHA-256 | `4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977` | PASS |
| Signature / version | FWS / 5 | PASS |
| Actual / declared byte length | 59,360 / 59,360 | PASS |
| Stage rectangle, twips | `[0, 7000, 0, 5000]` | PASS |
| Stage size | 350 × 250 | PASS |
| Frame rate / root frames | 30 FPS / 115 | PASS |

The helper only reads and emits file metadata. Its output explicitly says `FILE_IDENTITY_ONLY`; it cannot establish R01 native field dimensions or any AVM1 behavior. Four utility-only negative cases rejected a missing file, truncated header, non-FWS input and synthetic wrong-identity header. The reference hash remained unchanged. Synthetic inputs and `identity-utility-qa.json` are ignored under `captures-local/m4-2026-09-30/`; they contain no copied reference bytes or original assets. The SWF was not modified, copied or redistributed.

## Evidence inspected and runtime attempt

Read the current README, original-behavior specification, project boundaries, M0.5 runtime-verification report, compatibility assumptions and accepted M3 milestone. Reviewed the relevant player/enemy/ball, collision/display, lifecycle, scoring, tick and replay implementation and automated scenarios. The existing M0/M0.5 expectations, observer locations and R08 discriminating work order are in `docs/original-behavior.md` and `docs/runtime-verification.md`.

The M0.5 report references separate `M05_Runtime_Capture_Work_Order.md`, `runtime_hook_map.json`, `proposed_fixtures.json`, `capture_manifest.template.json`, `runtime_results.json`, and `verify_reference.py`. A repository search including ignored local areas (excluding `.git` and dependencies) did not find those files in this checkout. Their documented plans remain usable; no claim is made that a compiled observer or original-runtime trace was present. Static SWF research was not repeated, and the historical reports were not rewritten.

Measured host: Windows `win32`/`x64`, OS release `10.0.26300`; Node `v24.19.0`; Python `3.14.7`. Neither a stock nor instrumented AVM1 runtime was found in the bounded checks below. This is a statement about the inspected locations, not a claim to have enumerated every file on the machine.

| Check / actual attempt | Result |
|---|---|
| PATH lookup for `ruffle`, `flashplayer`, `cargo`, `rustc`, `rustup`, `cl` | None found |
| User `.cargo` / `.rustup`; MSYS2 UCRT64 and USR Rust candidates | No Rust toolchain found |
| Ruffle/Flash candidates in Downloads, Program Files directories and Local Programs | No runtime candidate found |
| Visual Studio Installer `vswhere.exe` | Locator absent; no MSVC installation identified by these checks |
| `wsl --list --quiet` | Windows reports WSL is not installed |
| Official Ruffle release metadata request, below | Failed before any runtime was acquired |

The one executable-acquisition probe was:

```powershell
Invoke-WebRequest -Uri 'https://api.github.com/repos/ruffle-rs/ruffle/releases/tags/v0.6.0' -TimeoutSec 25
```

It returned `System.Net.Http.HttpRequestException`:

```text
Foi feita uma tentativa de acesso a um soquete de uma maneira que é proibida pelas permissões de acesso. (api.github.com:443)
```

Meaning: an attempt was made to access a socket in a way forbidden by its access permissions. This is an environment access failure, not a release-not-found response or evidence about game behavior. `v0.6.0` was the historical M0.5 source locator used for this probe; its existence, exact commit and build identity were not established by the failed request. It is **not** a pinned runtime oracle. Separate research-browser opens of the historical GitHub contributing/player source URLs returned `Cache miss`; they supplied no executable or new source corroboration.

The investigation stopped at this concrete blocker. No alternative acquisition loop, escalation, system-wide/admin installation, WSL installation or security workaround was attempted. GCC, CMake and Ninja being present does not supply an AVM1 interpreter or the missing Rust build environment. No runtime checkout, archive, build tree, observer patch or executable was acquired or placed in the tracked source tree. No source-only expectation or mock was promoted to an observation.

## Requested original-runtime results

The runtime prerequisite failed before every gameplay experiment. There were **zero complete original-runtime frames, zero original callbacks, zero native hitTest observations, zero ordinary host-input sessions and zero controlled runtime fixtures**. No fields were injected. The existing R08 candidate remains analytical and unexecuted; its native transforms and acceptance have not been validated.

| Target | Attempt and result | Missing runtime evidence |
|---|---|---|
| R01 native field | Setup attempted; INCONCLUSIVE / NOT EXECUTED | Native field size, registration, logical boundaries and center |
| R02 centered serve | Blocked before input; INCONCLUSIVE / NOT EXECUTED | Cached displacement, MouseDown consumption, installed curve, first movement and awards |
| R05 boundaries/accuracy | Blocked before fixture; INCONCLUSIVE / NOT EXECUTED | Native touching/inside/outside, separate accuracy bands, outgoing velocity/curve |
| R06 walls | Blocked before fixture; INCONCLUSIVE / NOT EXECUTED | Integration, movement, decay, clamp, reversal, attenuation and corner order |
| R08 old display/new logical | Existing separating work order reviewed; INCONCLUSIVE / NOT EXECUTED | Actual hitTest boxes/transforms/result and branch from the prepared state |
| R14 callback/input order | Blocked before frame driver; INCONCLUSIVE / NOT EXECUTED | Full consecutive frames, publication generations, cached consumers and input dispatch |
| R10 score/bonus persistence | Blocked before session; INCONCLUSIVE / NOT EXECUTED | Waiting, decrement cadence, retained partial counter and both miss reset scopes |
| R11 rewind/retention | Blocked before lifecycle session; INCONCLUSIVE / NOT EXECUTED | Allocation generations, Load execution and retained/reconstructed paddle state |
| R12 after level 10 | Optional test NOT ATTEMPTED; prerequisite absent | Runtime undefined-entry consequence; no natural or injected completion evidence |

## Comparison, divergences and uncertainty

Original-runtime → CurveballNext comparison: **INCONCLUSIVE / NOT COMPARABLE for all requested targets**. There are no runtime observations to drive equivalent scenarios. MATCH count: **0**; measured DIVERGENCE count: **0**. Zero measured divergences does not establish agreement. A comparison harness with fabricated original values would not improve the evidence and was not added.

No gameplay or compatibility implementation correction was authorized by evidence from this attempt, and none was made. Core, presentation, host runtime, replay schema, dependencies, numerical policy and existing tests are unchanged. The known level-10 containment and stopped-miss guard remain documented policies, not newly observed original-runtime divergences.

| Question | M4 disposition |
|---|---|
| U01 field dimensions | OPEN; header/statically encoded geometry is not native readback |
| U02 quantization, overlap edges and old display timing | OPEN; R05/R08 did not execute |
| U03 cross-clip callback order | OPEN; R14 did not execute |
| U04 input/cache timing | OPEN; R02/R14 did not execute |
| U05 instance retention | OPEN; R11 did not execute |
| R10 scoring/time-bonus runtime persistence | OPEN; existing recovered rules remain provisional dynamically |
| U06 post-level-10 behavior | OPEN; CurveballNext containment unchanged; R12 absent |
| U07 stopped-miss click reachability | OPEN; no ordinary-input or injected runtime evidence |
| U08 historical score service | Unverified and outside this offline milestone; no service call made |
| U09 exact audiovisual timing | OPEN; no rendered/audible original session |

No directly encoded SWF behavior was dynamically confirmed, and no Ruffle-specific gameplay behavior was measured. Exact original-Flash equivalence remains unproven even for a future successful Ruffle-only experiment. The existing numerical policy is preserved: exact integers/enums/booleans/order, strict collision inequalities, mathematical test tolerance of absolute `1e-9` plus relative `1e-12`, and exact same-engine replay with signed zeros treated alike. The previously recorded cross-engine transcendental precision limitation remains separate. No tolerance was introduced or widened. No runtime value stream exists in this attempt; future probes must still preserve undefined, NaN, infinities and signed zero.

## Validation and changes

The installed dependencies were reused; `npm.cmd` was absent on the current PATH, so the exact local entry points underlying the package scripts ran through Node:

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
git diff --check
```

- **188 tests in seven files passed**, including existing deterministic state/event/audit replay, multi-rally/miss/retry and campaign scenarios, trace validation and 15/30/60/120/144 Hz cadence/jitter checks. These are CurveballNext checks, not original-runtime observations.
- Explicit typecheck passed; production build passed with Vite `8.3.1` (24 modules). Build artifacts remain ignored in `dist/`.
- Identity gate, `node --check` and four utility rejection cases passed; the private reference hash is unchanged.
- `git diff --check` passed; complete README diff and both new files were reviewed, including whitespace of untracked additions.
- No compatibility behavior changed, so no new compatibility regression test or observation → correction → comparison chain exists. Existing focused compatibility coverage passed within the full suite.

Files changed:

- `README.md`: link and factual blocked-attempt status.
- `docs/milestones/m4-original-runtime-parity-closure.md`: this evidence and continuation record.
- `tools/m4/verify-reference.mjs`: reusable read-only identity gate with failure exit codes; no gameplay instrumentation.

Existing compatibility/runtime documents, historical M0/M0.5 and accepted M3 records are unchanged. Local utility QA files under ignored `captures-local/m4-2026-09-30/` are not staged or distributed. No original executable content, artwork, audio, fonts, ActionScript, third-party runtime tree or large trace is added.

## Smallest continuation prerequisite and Git handoff

Supply a vetted AVM1-capable observer build in an authorized environment, or a pinned Ruffle checkout with a working target-compatible Rust/Cargo toolchain and its build dependencies available locally. For this Windows host, a prepared build environment avoids requiring an unapproved MSVC/WSL/system installation. A stock player alone can establish execution but cannot supply the required instruction/cache/bounds/lifecycle probes. No claim is made that an admin installation is universally necessary; the available environment could not acquire a runtime or build one with its inspected tooling.

The next operator must record the exact commit and executable/build hash, implement observation probes outside the unchanged movie, and use normal host input and complete runtime frames. Use the observer/work-order sections of `docs/runtime-verification.md`, including absolute-offset calibration and the R08 separating case. Buffer one monotonic observation sequence; distinguish ordinary input from every disclosed injected field; avoid getters/cache refreshes/new ActionScript/callback substitution. Complete R01/R02/R05/R06/R08/R14, then R10/R11; attempt R12 only if cheap. Compare actual observations under the existing numerical policy before making any root-cause correction. This is the next M4 prerequisite, not a request to begin a feature milestone.

Final local branch, HEAD and `origin/main` retain the baseline above; the index is empty. No commit, push, deployment, publication, history rewrite or Git staging occurred. Complete non-ignored status at handoff:

```text
## main...origin/main
 M README.md
?? docs/milestones/m4-original-runtime-parity-closure.md
?? tools/m4/verify-reference.mjs
```

**M4 RUNTIME VERIFICATION PARTIAL/BLOCKED — MAINTAINER DECISION REQUIRED**

## Continuation — actual runtime evidence

**Historical first successful runtime pass, before the maintainer authorized the provisional-oracle corrections.** Its counts, comparisons and handoff below describe that pass; the current outcome appears in the appended correction pass.

**Date:** 30 September 2026. **Outcome:** RUNTIME VERIFICATION PARTIAL; maintainer oracle/policy decision required. The original executed successfully. No runtime/toolchain acquisition blocker remains. This continues M4; no post-reconstruction milestone began.

### Preflight and identity

Before continuation writes, branch, HEAD, subject, local origin/main, complete non-ignored status and staged diff were verified. Branch `main`, HEAD and local origin/main remain `ab3cea33ddbd62f6277888532b5fc571b702bf72`, subject `Complete M3 offline presentation`. The index was empty. Only the expected prior README change, this M4 record and `tools/m4/verify-reference.mjs` were dirty. All were preserved. No reset, discard, staging, commit, push or history rewrite occurred. Ruffle started clean at the pinned commit below; no applicable AGENTS files were found in the checked locations.

The identity helper repeated the full reference gate before execution and again afterward: private `reference-local/curveball.swf`, SHA-256 `4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977`, FWS v5, actual/declared 59,360 bytes, 350 × 250, 30 FPS. The SWF was never modified, copied, committed or redistributed. The separate hook-map/fixture/manifest files cited by M0.5 remain unavailable in this checkout; its existing prose work order, including R08, was reused. Settled static research was not repeated.

### Runtime oracle

| Item | Measured identity |
|---|---|
| External checkout | `D:\Tools\ruffle-m4`, detached at tag `v0.6.0` |
| Pinned Ruffle commit | `cac5c99ce4a17e606f4ee3090389bb878f852055` |
| Instrumented executable | `D:\Tools\ruffle-m4\target\debug\examples\m4_capture.exe` |
| Executable SHA-256 | `7e62e751fc772e4afb746fa2fcab75dbd38f8ab9508f33421dc3d03b7e59da94` |
| Full probe patch | `tools/m4/ruffle-probes.patch`, 22,709 bytes |
| Patch SHA-256 | `18ecf239ded25c0708abf61a4bb2d959daf88c6eabee2d8668c4aed7e0323c7c` |
| Rust | `1.98.1 (48a229cea 2026-09-01)`, full commit `48a229ceaefd4985c50990b14116b6d856af0985`, LLVM 22.1.8 |
| Cargo / toolchain | `1.98.1 (797e8a9bc 2026-08-05)` / `stable-x86_64-pc-windows-msvc` |
| Java | Microsoft OpenJDK `21.0.12.1`, build `21.0.12+1-LTS`; `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot` |
| VS locator | Installed VC x64/x86 tools component; installation version `18.10.12217.157` |
| Frontend | Headless core; original 30-FPS movie, 350 × 250 viewport/scale1; blocking preload/autoplay; normal PlayerEvent and complete Player.run_frame |
| Backends | Default null renderer/audio/network; default player version32 (`$version` platform string LNX); original remains AVM1 SWF5 |
| Historical native Flash equivalence | **UNVERIFIED** |

The maintainer's stock desktop sanity session established availability only. The desktop was not rebuilt or used as the capture oracle; its SHA-256 was `b8eb5c9c987603902a6959935daf661f899d243d26f9cc91789079cc8912f1bc`. The smaller example runs the genuine core interpreter, native display/collision and timeline paths. It does not render original assets or measure desktop wall-clock cadence/audiovisual timing. `cargo build -p ruffle_core --example m4_capture --offline --locked` succeeded using prepared dependencies. JAVA_HOME/PATH were set only in that process. No system/admin installation, network acquisition or security workaround occurred. Cargo manifests/lockfile stayed unchanged; runtime trees/builds stayed outside CurveballNext.

### Observation integrity and reproduction

The patch changes six existing Ruffle files (26 additions, three deletions) and adds `core/src/m4.rs` plus `core/examples/m4_capture.rs`. Hooks cover player input/frame/action-queue boundaries, AVM1 action execution and actual Get/SetMember/Get/SetVariable sites, the existing native object/object hitTest return, allocation/goto/post-instantiation and child removal. The actual hitTest runs once and returns its unchanged Boolean. No original callback logic or execution-list/queue order is replaced.

Snapshots read enumerable stored property.data, native bounds and matrices through pure read paths. They do not invoke AVM1 getters, evaluate ActionScript, refresh caches or write game state. Selected instruction probes observe state before the real instruction. Frame-end occurs after original update/action draining. The movie buffer is asserted to be an exact suffix of the verified FWS; the 20-byte shift calibrates M0 absolute offsets. Each independent process/session uses one contiguous monotonic sequence for all input, action, instruction, field, contact, lifecycle and frame observations. Allocation metadata distinguishes retained/replaced clips; names are not proof of identity. Logging buffers to memory and flushes after the session.

Finite numbers retain JSON round-trip precision. Undefined, NaN (with payload bits), infinities and negative zero have explicit tags. R12 actually observed undefined fields; no undefined-motion/NaN trajectory is claimed. Redundant original opcode writes still receive new provenance. Ordinary reads validate namespace, field and value against their exact source-write sequence/frame. Raw process addresses are omitted from tracked evidence. Direct fixture writes do not update that opcode provenance map: injected values derive from the full fixture-before/after list, and those raw stamps must not be treated as original-write provenance.

Fixture preparation is separate from observation. Every numeric stored field/native display write is disclosed in the generated driver, trace and derived case. Preparation uses the host context without evaluating ActionScript or draining the queue, then the original normal callback/frame path executes. Some fixtures deliberately separate installed display and logical position. Injected evidence proves behavior from its prepared state, not human reachability. The fixture JSON parser produces 18 disclosed one-step binary64 decimal differences across 12 cases. Both requested and actual writes are retained; provenance checks verify command structure and flag these codec differences separately. Comparisons use the actual prepared state, without changing gameplay tolerances. No game callback is hand-called or replaced.

From CurveballNext, after applying the patch to a clean external pinned checkout and building the example there:

```powershell
node tools/m4/verify-reference.mjs reference-local/curveball.swf
node tools/m4/make-drivers.mjs
node tools/m4/run-drivers.mjs D:\Tools\ruffle-m4\target\debug\examples\m4_capture.exe reference-local/curveball.swf
node tools/m4/derive-evidence.mjs
node tools/m4/run-comparison.mjs
node node_modules/vitest/vitest.mjs run tests/m4-parity.test.ts
```

The runner verifies reference hash, opens the unchanged movie, clicks the real Start button through normal input and advances whole frames. Inputs are deliberately delivered between complete frames; movie frame rate is unchanged. This does not characterize arbitrary asynchronous OS arrival. Comparison loads current production Next modules through the existing pinned Vite dependency. Mechanism comparisons align measured checkpoints and native old boxes, then run production serve/tick; they do not imply full accumulated state parity. Ordinary moving-input/rally comparisons retain their distinct evidence class. Original actor absence is recorded rather than replaced with invented state.

Ignored raw drivers, execution manifest and JSONL traces are in `captures-local/m4-continuation/generated/`. The final corpus has **55 independent sessions, 4,650 complete frames and 163,278 observations**, including title/initialization. Three sessions use only ordinary input; 52 contain disclosed preparation. The common boot checkpoint is deduplicated only after exact equality checks. Derived JSON (~470 KiB) retains selected consecutive/transition frames, contacts/transforms/bounds, Load/removal/rewind identities, publications and instruction-state changes. No original assets or ActionScript are tracked.

### Executed R targets and Next comparison

| Target | Actual observation in pinned Ruffle | Comparison |
|---|---|---|
| R01 | Native width301/height201, registration(25,25). Game logical bounds25–326 /25–226 and center(175.5,125.5). Stroke bounds24.5–325.5 /24.5–225.5; visual bounds center(175,125). | **MATCH** for logical geometry; independent Next presentation has no original field artwork to compare. |
| R02 | Ordinary stable integer pointer(176,126): zero-displacement prior cache, curves(−.01,+.01), vz2, score+100 accuracy/no serve hit award. Exact-centered fixture cache(175.5,125.5): curves(−.01,−.01), first position(175.49,125.51,2), decay and +100 score. | **MATCH** at equivalent measured-cache dispatch/first-flight checkpoint. Moving-input generation differs under R14. Exact-centered evidence is injected. |
| R05 | 24 near/far x/y both-sign edge fixtures: one twip inside and exact touch accepted, one twip outside rejected. 18 separate accuracy/velocity cases: inclusive ±7/±5 logical thresholds, retained lateral velocity, zero stationary return curve. | Near edges/all accuracy cases **MATCH**; four far exact-touch cases **DIVERGE** under nominal identity projection. Native installed display values also differ. |
| R06 | Right, left, top/right corner and bottom: curve addition → z/x/y movement → decay → clamp → curve attenuation → velocity reversal. Corner y before x. Final corner position(311,40,37), velocity(−1.5,−1.25,2), curves(.41500664010624166,.20750332005312083). | Final logical values/events **MATCH**. Assignment order initially **DIVERGED**, now **MATCH** in all four branches after the minimal correction. Native display installation still differs. |
| R08 | Prepared ball(217.5,125.5,1), vx20/vz−2/no curve. Actual contact sees new logical(237.5,125.5,−1) but old display x216.6/width29.4/world bounds[201.9,110.8,231.3,140.2]. True hit, z0/vz+2/vx20, +100 hit/no accuracy. New display x237.5/width30 would miss. | **MATCH** for old-box input/decision, response/score and new-box separating counterfactual; prepared reachability unproven. |
| R14 | Ten consecutive stable frames per ordinary session plus transition windows. ball80/E10 → marker77/E08 → enemy75/E06 → player59/E04. Ball reads previous paddle publication; enemy current ball publication. E11 MouseDown synchronously consumes existing cache before next frame. | **DIVERGENCE**: Next player→enemy→ball/prior-ball AI. Equivalent integer movement yields original curves(−.01,+.01)/score100, Next(−1.04,+.64)/score150. Fractional pointer(175.5,125.5) becomes(176,126) in Ruffle input; Next identity differs. |
| R10 | 22 ordinary waiting frames preserve3000/counter10. Every11 eligible updates lower25/reset10. Prepared misses retain partial counter5 across19-interval hold, rewind/waiting; six resumed updates give2975/counter10. Player miss restores buckets, enemy miss retains prepared70/35/105/60. | **MATCH** for award/life reset scope, waiting/cadence, partial retention/resumption, completion award and next-level world setup. |
| R11 | Retry retains player12/enemy16; removes ball18 on rewind91, Loads ball20 at next placement92. Off-center player(296,206)/previous state survive. Level transition45 retains player12, removes enemy16/ball18, later Loads enemy22/ball24, no new player Load. | Same-level identity policy **MATCH**. **DIVERGENCE** for temporary original ball absence versus immediate Next ball, and level player retention versus Next recenter/new trial. Retained player runs during Ruffle intro; Next freezes actors. Broader lifecycle parity unclaimed. |
| R12 | Cheap injection world.level10/enemyLives1 into level1, cached difficulty1 retained, plus disclosed forced miss. Original branch advances11/score3100/rewind45; later setup/new clips load undefined speed/curve/skill. No naturally reached level10 or undefined flight. | Branch **DIVERGENCE** from declared Next level10 containment; undefined playability **INCONCLUSIVE / NOT COMPARABLE**. Containment unchanged. |

[Component comparison](../evidence/m4-comparison.json): **257 MATCH, 98 DIVERGENCE, one INCONCLUSIVE / NOT COMPARABLE** after correction. These include repeated callback/display rows, not 98 independent defects or 257 fully matching sessions. All 55 sessions receive comparisons. Checkpoint ball agreement does not establish whole-state/actor/display/history parity. The ordinary stationary rally reaches native near/far contacts and agrees on compared ball/awards; it does not erase the independent moving-input discrepancy.

Integers/enums/booleans/order compare exactly. Math retains abs`1e-9` + rel`1e-12`; collision inequalities have no tolerance. Signed zero follows existing replay equality while raw observations retain its tag. Nominal far projection at z75 differs slightly from .25; native twip/f32 installation gives exact15×10 paddle/7.5×7.5 ball boxes, causing strict far-touch discrepancies. This display effect is separate from transcendental precision. No unexplained transcendental-only logical gameplay divergence was found; no tolerance was widened.

### Evidence-backed correction and remaining uncertainty

Selected instruction changes: y clamp `0xC1C5`, curve attenuation `0xC1FC`, velocity reversal `0xC21B`; right branch `0xC3E5`, `0xC41C`, `0xC43B`. Left/bottom fixtures confirm their branch order independently. These are assignments inside the original action, with no intervening native getter/callback; they do not depend on Ruffle collision/scheduling policy.

Only four `core/collisions.ts` branches were corrected from clamp → reversal → attenuation to clamp → attenuation → reversal. Final values/events, equations/coefficients, scoring/difficulty, host/profile, display adapter and replay schema are unchanged. [Before/after evidence](../evidence/m4-wall-order-correction.json) uses the same original observation corpus: all four assignment-order rows DIVERGENCE before, MATCH after. The observation regression failed against the M3 order and passes after correction, with full gates passing. This supplies observation → root cause → correction → regression → successful comparison.

No broad callback, quantization, input, availability or retention correction was made. These differences depend on Ruffle native execution-list/display/rewind behavior and headless host semantics; M0 explicitly left them uncertain. A maintainer can adopt pinned Ruffle as the compatibility oracle or require targeted historical Flash observations. Neither decision is silently made here. R12's already-declared containment is preserved. No profile freeze/native parity claim follows.

| Question | Before continuation | After continuation |
|---|---|---|
| U01 | No runtime field readback | Ruffle dimensions/registration/logical and visual centers established; logical Next match. Native Flash equivalence open. |
| U02 | No native boxes/results | Tested edges/transforms/R08 established; display/far-touch divergences. General/native-Flash policy open. |
| U03 | No executed frame trace | Ruffle order/publication ages established; Next divergence; Flash order open. |
| U04 | No actual input/cache provenance | Ruffle synchronous consumption/generation established; moving-input divergence; Flash/asynchronous host scope open. |
| U05 | No allocation/Load/rewind trace | Ruffle tested per-object policy established, partial Next match; Flash/compatibility decision open. |
| R10 | Static recovered rules | Dynamically confirmed ordinary waiting/cadence and prepared miss persistence; full natural campaign unclaimed. |
| U06 | Static post10 increment | Injected Ruffle increment/undefined setup observed; natural reachability/playability open. |
| U07 | Stopped-miss click open | Not attempted; remains open. |
| U08 | Historical service unverified | Null network; remains outside offline scope. |
| U09 | Audiovisual timing open | Null renderer/audio; no new timing evidence. |

U01–U05 are now observed in Ruffle for these scopes, but **none is closed as historical native-Flash equivalence**. Static evidence, Ruffle observations, Flash compatibility assumptions and Next behavior remain distinct. Historical M0/M0.5 and M3 reports were not rewritten as successful runtime investigations.

### Validation and changed files

- All55 final-executable sessions executed. Derivation validates complete begin/end pairs, contiguous sequence, raw/driver hashes, common boot equality and ordinary source-read provenance. Final reference gate PASS.
- **208 tests/eight files PASS**. Twenty new M4 tests compare actual observations, explicit remaining divergences, four wall assignment sequences and exact deterministic replay from a measured wall checkpoint. Existing campaign/multi-rally/retry, event/audit replay, cadence/jitter and trace-validation gates remain covered.
- Typecheck PASS; production build PASS (Vite8.3.1, 24 modules). M4 JS syntax checks PASS.
- Ruffle offline/locked build PASS, source-patch reverse-apply check PASS, external whitespace check PASS, unchanged manifests/lockfile. Full CurveballNext diff/new additions reviewed and whitespace checked.
- No original assets/ActionScript, runtime source/build tree or large raw traces are among the additions.

Changed: README; compatibility assumptions; runtime-verification historical continuation link; this milestone; `src/core/collisions.ts`; `tests/m4-parity.test.ts`; `docs/evidence/{m4-ruffle-observations.json,m4-comparison.json,m4-wall-order-correction.json}`; `tools/m4/{verify-reference.mjs,make-drivers.mjs,run-drivers.mjs,derive-evidence.mjs,compare.ts,run-comparison.mjs,ruffle-probes.patch}`. The identity helper is preserved unchanged from prior M4. Build output/raw captures stay ignored; private reference stays in its ignored area.

### Final Git handoff

Both indexes empty; no commit, push, staging, publication/deployment or history rewrite. CurveballNext retains accepted branch/HEAD/subject/local origin/main. Complete non-ignored status:

```text
## main...origin/main
 M README.md
 M docs/compatibility-assumptions.md
 M docs/runtime-verification.md
 M src/core/collisions.ts
?? docs/evidence/m4-comparison.json
?? docs/evidence/m4-ruffle-observations.json
?? docs/evidence/m4-wall-order-correction.json
?? docs/milestones/m4-original-runtime-parity-closure.md
?? tests/m4-parity.test.ts
?? tools/m4/compare.ts
?? tools/m4/derive-evidence.mjs
?? tools/m4/make-drivers.mjs
?? tools/m4/ruffle-probes.patch
?? tools/m4/run-comparison.mjs
?? tools/m4/run-drivers.mjs
?? tools/m4/verify-reference.mjs
```

Complete non-ignored Ruffle status; detached HEAD remains `cac5c99ce4a17e606f4ee3090389bb878f852055`:

```text
 M core/src/avm1/activation.rs
 M core/src/avm1/globals/movie_clip.rs
 M core/src/display_object/container.rs
 M core/src/display_object/movie_clip.rs
 M core/src/lib.rs
 M core/src/player.rs
?? core/examples/m4_capture.rs
?? core/src/m4.rs
```

**M4 RUNTIME VERIFICATION PARTIAL/BLOCKED — MAINTAINER DECISION REQUIRED**


## Correction pass — authorized provisional oracle

**Date:** 30 September 2026. **Outcome:** completed and accepted after final independent review; no later milestone started. This pass uses the maintainer's explicit instruction to adopt pinned Ruffle for clear, static-consistent U01–U05 observations. It does not adopt historical Flash equivalence or erase the earlier blocker/divergences.

### Preflight and runtime identity

Before edits, branch `main`, HEAD/local `origin/main` `ab3cea33ddbd62f6277888532b5fc571b702bf72`, subject `Complete M3 offline presentation` all matched. Index was empty. The expected existing uncommitted M4 README/compatibility/runtime docs, collision correction, evidence, milestone, test and helpers were present and preserved. No unrelated dirt was found. The private reference passed the full FWS5/350×250/30FPS/59,360-byte/SHA-256 gate again; it was neither altered nor copied.

Ruffle remains external at `D:\Tools\ruffle-m4`, detached at v0.6.0 / `cac5c99ce4a17e606f4ee3090389bb878f852055`. Existing instrumentation was reused unchanged. Executable SHA-256 remains `7e62e751fc772e4afb746fa2fcab75dbd38f8ab9508f33421dc3d03b7e59da94`; probe patch SHA-256 remains `18ecf239ded25c0708abf61a4bb2d959daf88c6eabee2d8668c4aed7e0323c7c` (22,709 bytes). Rust1.98.1/Cargo1.98.1, stable-x86_64-pc-windows-msvc and Microsoft OpenJDK21.0.12.1 identities are unchanged from the successful pass above. There was no new acquisition, installation or runtime modification.

**The unchanged original SWF actually executed in every correction-pass session.** Real AVM1, native hitTest, original action callbacks and timeline ran with normal PlayerEvent delivery between whole frames. Headless/null renderer/audio/network, viewport350×250/scale1, original30FPS and playerVersion32 remain the same. Instrumentation diff review and reverse-apply check passed; original actions/order/hitTest were not replaced. Controlled preparation remains fully disclosed, separate from observation probes and ordinary input.

### Captures and repeatability

The fresh ignored corpus is `captures-local/m4-correction/generated/`: **63 sessions, 5,371 complete frames, 192,372 observations**. Four sessions are ordinary-input only;59 are controlled fixtures. It independently reran all55 first-pass sessions, then added six display depths (0,1,15,37.5,74,75), odd fractional mouse ties (177.5/127.5), and pointer movement through a prepared level transition. Added display fixtures disclose logical position(210.037,98.013,z), zero motion/curve and explicit display preparation; the intro case discloses its forced enemy miss/enemyLives1 and uses ordinary pointer delivery afterward. None proves human reachability of its prepared state.

`verify-repeatability.mjs` exactly compares the first55 sessions' derived states, native bounds, actions/order, input, driver identities, injection disclosure and read provenance across independent runs. Only raw pointer-containing trace hashes are excluded from semantic equality and recorded separately. **All55 are exact derived repeats.** The original first-pass479,305-byte observation file was reconstructed from preserved raw captures and verified against its historical SHA-256 `fb916f2af113cfa0186668a45bc142bcf959f63a6cd32893cbb6a8b35b1ac81b`; the wall-order evidence retains that hash and its before/after rows, with an additional current-corpus hash. The expanded derivation retains lifecycle frame snapshots through each measured Load/cache boundary. No original ActionScript/assets or large raw trace is tracked.

### Corrections by semantic cause

| Original runtime observation | Previous Next semantics | Smallest correction / regression / comparison |
|---|---|---|
| R02/R14 ball→marker→enemy→player. Ball samples prior player/enemy publications, publishes current ball for AI. MouseDown consumes the preceding ball cache synchronously. Integer move215/150 then down220/155 consumes zero prior displacement, curve(−.01,+.01), score100. | Player/enemy before ball refreshed moving displacement26/16, curve(−1.04,+.64), score150; AI read prior ball. | Run ball→enemy→player, retain ordinary input-before-actions and true sample/publication stamps. Actual callback audit replaces the harness's old hardcoded expectation. Focused score100/cache-age/current-AI regressions and focused original comparison pass. |
| R05/R14 native positions truncate pixels×20 to twips; scale coefficients are float32; transformed centered vertices round ties to even. Mouse local readback passes device pixels at the measured viewport. Original player myPos/oldPos and publication remain logical binary64: intro frame+1 x135.33333333333334 versus display135.3. | Identity display/input adapter; native player readback fed logical movement. | General axis-aligned adapter using source dimensions, twip positions and float32 transformed bounds; preserve logical paddle position/previous/displacement separately; map normal host target through measured device-pixel readback. All24 edges,18 accuracy/velocity cases,six new depths,two fractional ties and moving/intro publications match. No fixture exceptions or tolerance widening. |
| R11 automatic retry removes ball at resolution; new ball Load+1 leaves cache undefined; first callback/cache+2. Root publication persists through Load. Level transition retains and updates player, resets awards/bonus+45, enemy Load+46, ball Load+47, ball callback/cache+48. | Immediate fresh ball/publication/cache readiness; rebuilt centered player/frozen intro; immediate bonus reset. | Explicit actor availability and pending Load boundaries, retained player/target/logical previous state, delayed setup and root publication. Numeric unavailable placeholders simplify serialization. Focused retry/intro/Load-publication replay regressions and full measured lifecycle windows match. |
| R06 original instruction assignments clamp→attenuate→reverse, y before x. | M3 clamp→reverse→attenuate. | Preserve first-pass four-branch correction and before/after evidence. Four wall setter-order/value/event regressions remain MATCH. |
| R12 injected completion increments level11 and later loads undefined difficulty; natural reachability/playability unestablished. | Declared level10 ContentComplete policy. | No gameplay correction. Explicit **INTENTIONAL CURVEBALLNEXT CONTAINMENT** comparison. Bonus awarded once, no undefined difficulty lookup. |

The far-touch root cause is not four independently patched edge fixtures: ball-first contact now sees the previous native enemy box instead of a newly installed nominal undersized binary64 box. The general display policy then maintains native15×10 far paddle bounds on subsequent frames. Near-plane decisions, logical inclusive±7/±5 accuracy and R08 old-box semantics remain intact. The source rule is corroborated by pinned `swf/src/types/twips.rs`, `render/src/matrix.rs`, `core/src/display_object.rs`, and AVM1 `object/stage_object.rs`; this explains measured Ruffle behavior, not independent Flash certainty.

The original stopped ball EnterFrame preceding resolution is a no-op. Next need not instantiate that callback or timeline machinery to preserve the measured consequences. Developer Retry remains the explicit immediate M2 fixture; automatic original rewind follows the new delayed availability path. Player input continues through the independent intro screen. The accepted45-tick visual progress remains, with measured gameplay Load/cache readiness at+47/+48. Availability now hides removed actor drawings/debug bounds; no new presentation design was introduced.

### Final R targets and U status

| Target | Final result against pinned oracle | Scope |
|---|---|---|
| R01 | MATCH | Native301×201; registration/logical bounds/center. Stroke center distinct. |
| R02 | MATCH | Stationary/exact-centered prepared serves, first movement and ordinary moving-input cache/spin/score100. |
| R05 | MATCH | Both-sign near/far inside/touch/one-twip-outside, logical accuracy, outgoing velocity/curve; general axis-aligned installed bounds and measured input readback. |
| R06 | MATCH | Acceleration,movement,decay,clamp,attenuation,reversal and y-before-x, including original instruction order. |
| R08 | MATCH | Actual native hitTest old display box versus new logical state; separating counterfactual. |
| R10 | MATCH | Waiting,cadence,partial retry counter,bucket reset/persistence,lives/completion award and delayed level setup. |
| R11 | MATCH for observable measured semantics | Availability,prior root publication,Load/cache delay,retained player/target/movement,enemy reconstruction. No synthetic timeline equivalence claim. |
| R14 | MATCH | Recorded consecutive complete frame order,prior paddle/current ball publication ages,MouseDown cache consumption. |
| R12 | INTENTIONAL CURVEBALLNEXT CONTAINMENT | Injected original level11/undefined setup versus contained level10; natural path NOT ESTABLISHED. |

| U item | Before this correction pass | After, against pinned provisional oracle |
|---|---|---|
| U01 | Runtime geometry established; native Flash unverified | RESOLVED in measured scope; geometry unchanged/MATCH |
| U02 | Native boxes/old display measured; identity display/far touch uncertain/diverged | RESOLVED for axis-aligned actor shapes and captured scale1 input; MATCH |
| U03 | Actual order/ages established; Next diverged | RESOLVED for recorded complete frames; MATCH |
| U04 | Synchronous prior cache established; moving-input score/spin diverged | RESOLVED for recorded between-frame input; MATCH |
| U05 | Retry retention partly matched; availability/level player policy diverged | RESOLVED for measured retry/level lifecycle consequences; MATCH |

**All five historical Adobe Flash Player equivalences remain unproven.** No unresolved behavior is silently frozen. U06 natural post10, U07 stopped-miss and early-Load click behavior, U08 historical high-score service and U09 exact audiovisual timing remain open. Current invalid-cache/MissHold guards remain deliberate containment outside the verified scenarios. Arbitrary asynchronous OS input,other viewport scale/transforms and a fully naturally reached campaign are not demonstrated.

### Comparison and validation

The expanded automated production harness reports **759 MATCH component rows, one INTENTIONAL CURVEBALLNEXT CONTAINMENT, no unclassified DIVERGENCE** across63 executed cases. Row totals are not independent defects or exhaustive gameplay proofs. Three semantic root causes (scheduling/cache ages,display/input with logical separation,lifecycle consequences) are corrected; R06 was already corrected; R12 is retained. All successful observations receive equivalent checkpoint/scenario comparisons. Discrete/bounds/order are exact; logical math still uses abs1e-9+rel1e-12; collisions have no tolerance. No unexplained transcendental-only gameplay divergence was identified; historical cross-engine precision limitations remain distinct.

Deterministic profile is now `m4-ruffle-06-01`. Envelope `curveball-m2-trace-2` remains, with required actor availability/Load fields. Old `m1-provisional-01` captures are explicitly rejected instead of being replayed under changed semantics. Checkpoint validation permits prior-generation root publication only at a fresh Load boundary with no cache; malformed schedules,absent-actor caches and stale active publications are rejected. Accepted tests were changed only where measured semantics superseded their selected policy; original mathematical recurrence tests keep an explicit identity input adapter and never count as runtime evidence.

Validation:

- Full automated suite **218 tests/eight files PASS**, including exact deterministic replay,campaign/multi-rally,ring checkpoints,clock/input cadence and malformed capture tests.
- Focused M4 parity suite **26 tests PASS**, including100-versus150 regression,all original wall assignment cases,display depths,Load/publication ages,retained intro movement and measured replay.
- Typecheck PASS; production build PASS (Vite8.3.1,24 modules). Equivalent package-script tools run directly through Node because npm/npx shims are absent from this shell PATH; no dependencies/toolchains changed.
- Reference identity gate PASS;63-session contiguous observation/whole-frame/driver/injection/provenance derivation PASS;55 independent exact derived repeats PASS; comparison PASS under classifications above.
- Both `git diff --check` gates PASS; untracked text whitespace/syntax/provenance checked; full Next diff/new helpers/evidence and entire Ruffle instrumentation reviewed. Ruffle reverse-apply patch check and executable/probe identity PASS. Runtime instrumentation unchanged in this pass; no rebuild required.

Reproduce the current corpus with the make/run/derive/compare commands recorded above (helpers now default to `captures-local/m4-correction/generated/`). To audit independent repeats with the preserved original corpus:

```powershell
node tools/m4/derive-evidence.mjs captures-local/m4-continuation/generated captures-local/m4-correction/prior-derived.json
node tools/m4/verify-repeatability.mjs
```

See [current observations](../evidence/m4-ruffle-observations.json), [comparison](../evidence/m4-comparison.json), [correction/repeatability summary](../evidence/m4-correction-pass.json), and [preserved wall evidence](../evidence/m4-wall-order-correction.json). New tracked material contains derived numeric evidence/helpers only; original SWF/assets/ActionScript,runtime checkout/build and raw captures remain private/ignored/external.

### Correction-pass files and Git handoff (historical)

The complete CurveballNext status below enumerates every changed/new file, including inherited M4 work. The reference identity helper and probe patch remain unchanged from the first successful pass. README/compatibility/runtime links and this record are updated; no M0/M0.5 historical results or M3 acceptance record was rewritten. Both indexes remain empty. Nothing was committed,pushed,deployed,staged or rebased.

```text
## main...origin/main
 M README.md
 M docs/compatibility-assumptions.md
 M docs/runtime-verification.md
 M src/compat/display.ts
 M src/compat/profile.ts
 M src/core/actors.ts
 M src/core/ball.ts
 M src/core/collisions.ts
 M src/core/lifecycle.ts
 M src/core/projection.ts
 M src/core/state.ts
 M src/core/tick.ts
 M src/core/types.ts
 M src/debug/replay.ts
 M src/presentation/canvas.ts
 M tests/core.test.ts
 M tests/diagnostics.test.ts
 M tests/m2-corrections.test.ts
 M tests/m2.test.ts
 M tests/runtime.test.ts
?? docs/evidence/m4-comparison.json
?? docs/evidence/m4-correction-pass.json
?? docs/evidence/m4-ruffle-observations.json
?? docs/evidence/m4-wall-order-correction.json
?? docs/milestones/m4-original-runtime-parity-closure.md
?? tests/m4-parity.test.ts
?? tools/m4/compare.ts
?? tools/m4/derive-evidence.mjs
?? tools/m4/make-drivers.mjs
?? tools/m4/ruffle-probes.patch
?? tools/m4/run-comparison.mjs
?? tools/m4/run-drivers.mjs
?? tools/m4/verify-reference.mjs
?? tools/m4/verify-repeatability.mjs
```

Complete non-ignored Ruffle status (unchanged by this correction pass):

```text
 M core/src/avm1/activation.rs
 M core/src/avm1/globals/movie_clip.rs
 M core/src/display_object/container.rs
 M core/src/display_object/movie_clip.rs
 M core/src/lib.rs
 M core/src/player.rs
?? core/examples/m4_capture.rs
?? core/src/m4.rs
```

Ruffle HEAD remains detached at `cac5c99ce4a17e606f4ee3090389bb878f852055`, tag v0.6.0; no instrumentation commit exists. CurveballNext remains `main`, HEAD/local origin/main `ab3cea33ddbd62f6277888532b5fc571b702bf72`, subject `Complete M3 offline presentation`. Final staged diff is empty in both repositories.

**M4 COMPLETED AND ACCEPTED**

## Final independent review and closure

**Date:** 30 September 2026. **Verdict:** **ACCEPT** for the documented M4 scope. This is independent implementation/evidence review and automated original-runtime reproduction, not new maintainer-performed physical audiovisual acceptance. No closure-blocking defect was found. No feature or subsequent milestone was implemented.

The review verified `main`, HEAD, local `origin/main` and direct remote main at the accepted pre-M4 commit `ab3cea33ddbd62f6277888532b5fc571b702bf72` (`Complete M3 offline presentation`), with an empty index and the complete M4 work preserved. The external Ruffle checkout remains detached at `cac5c99ce4a17e606f4ee3090389bb878f852055`. Executable and full instrumentation patch hashes match the recorded oracle identities. Neither repository was staged, committed or pushed; no deployment occurred.

Reviewed all four evidence JSON files, the milestone, compatibility assumptions, runtime-verification report, README, project boundaries, every M4 helper, all changed gameplay/runtime/presentation files and tests, and the complete Ruffle instrumentation including its two added files. The patch reverse-apply check passed. Observation hooks read stored properties/native bounds and record the existing execution paths; native hitTest executes once and returns its unchanged result. Fixture preparation is separate and disclosed. The instrumentation does not manufacture the measured callback, contact or lifecycle behavior.

The original-runtime → production implementation → regression chain supports the final target table above. R02/R14 use prior paddle publications in the ball callback, current ball publication for AI, and the preceding ball cache on MouseDown; the ordinary moving-input case scores 100. R05 uses one general axis-aligned twip/float32 rule and independent logical state, without fixture exceptions; all 24 edge cases, 18 accuracy/velocity cases, six depth probes and both fractional ties pass, and R08 keeps old-display contact. R11 reproduces removed-ball availability, Load/cache and deferred setup/publication boundaries, retained player identity and continued movement, without copying unnecessary Flash timeline structure. R06 retains the captured clamp → attenuation → reversal order and y-before-x; its historical before/after evidence and hash remain intact. R12 remains intentional level 10 containment; injected original undefined-level behavior is separately recorded.

Final gates passed:

- Full suite: 218 tests in eight files; focused M4 suite: 26 tests; exact deterministic replay, campaign/ring checkpoints and malformed-capture regressions pass.
- Typecheck and production build pass; every M4 JavaScript helper passes its syntax check.
- Fresh execution of all 63 original sessions reproduces 5,371 complete frames and 192,372 observations, with contiguous sequence, whole-frame, driver/input/injection and source-write provenance verification. All 63 are exact derived repeats of the correction corpus; all 55 first-pass sessions independently repeat exactly as well. Raw pointer-containing trace hashes remain separately recorded.
- Comparison from fresh evidence and from the retained evidence both gives 759 MATCH components, one INTENTIONAL CURVEBALLNEXT CONTAINMENT and zero DIVERGENCE. Totals describe tested components, not exhaustive gameplay equivalence.
- Reference identity, executable/probe identity, current/historical evidence hash links, repeatability report regeneration, complete diff/material review and both Git whitespace gates pass. Ordinary new text also passes whitespace checking. Treating the retained unified-diff artifact as plain text flags its standard single-space blank context markers; these are preserved with the patch identity, and reverse-apply/source whitespace checks pass. Original material and raw traces remain private/ignored/external.

The accepted deterministic profile is `m4-ruffle-06-01`; changed callback/display/lifecycle semantics justify the transition. The `curveball-m2-trace-2` envelope is retained, old-profile captures are explicitly rejected and no silent fallback exists. Replay covers fresh Load with retained prior-generation root publication and the subsequent cache/publication boundary. Discrete/order/native-bound comparisons remain exact; logical math retains absolute 1e-9 plus relative 1e-12 and collisions have no tolerance.

Acceptance is limited to verified/tested behavior of the pinned provisional Ruffle oracle. Historical Adobe Flash Player equivalence, natural post-level 10 reachability/playability, stopped-miss/early-Load click reachability, arbitrary asynchronous desktop input timing, exact audiovisual timing and historical online services remain unverified. Other viewport scales/transforms and a fully naturally reached campaign are not demonstrated. The deliberate invalid-cache/MissHold guards remain outside the verified input scenarios. This closure does not rewrite M0/M0.5 or freeze an unqualified historical Flash contract.

Closure wording is updated in README, compatibility assumptions, the historical runtime report's continuation note and project boundaries. The blocked attempt, investigation history, derived evidence and R06 before/after record are preserved. Commit authorization remains a separate maintainer action. No later milestone has begun.
