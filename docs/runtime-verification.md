# Curveball — M0.5 Runtime Verification Report

**Historical report:** The blocked results below describe M0.5 on 29 September 2026. The later [M4 continuation](milestones/m4-original-runtime-parity-closure.md#continuation--actual-runtime-evidence) executed the unchanged movie in pinned Ruffle. The [final independent M4 review](milestones/m4-original-runtime-parity-closure.md#final-independent-review-and-closure) accepted and closed M4 against that provisional oracle, with U01–U05 resolved within measured scopes, intentional R12 containment and explicitly retained uncertainties. This does not retroactively change M0.5 or prove historical Flash equivalence.

**Date:** 2026-09-29  
**Status:** EXECUTION BLOCKED — NO GAMEPLAY RUNTIME OBSERVATIONS  
**Contract readiness:** **NO**  
**Scope:** Narrow continuation of *Curveball — Original Behavior Specification* (M0).

> The reference file passed its identity gate. The original SWF did not execute in this environment: no Flash/AVM1 runtime was installed, runtime downloads failed, and the browser blocked the Ruffle demo. Therefore all six priority gameplay tests remain **INCONCLUSIVE**, not passed or failed. This report records the attempts, preserves the M0 expectations, and supplies a targeted capture work order. It does not claim native Flash or Ruffle behavioral verification.

## 1. Runtime environment

### 1.1 What actually ran

| Component | Observed environment / outcome |
|---|---|
| Operating system | Linux 6.18.44, x86-64; glibc 2.41 |
| Python | 3.13.5; used for file identity and environment diagnostics only |
| Browser | Chromium 144.0.7559.96; successfully launched through Playwright |
| Browser test viewport | 350 × 250 CSS pixels, device-pixel ratio 1; WebAssembly available |
| Original Flash Player / debugger | No installed executable found; launch failed before loading the SWF |
| Ruffle desktop / web runtime | No installed runtime found; no runtime package acquired |
| Rust build toolchain | Neither `cargo` nor `rustc` found in PATH |
| AVM1 runtime actually used | **None** |
| Original SWF execution / captured gameplay events | **No / 0** |
| Source reference consulted | Ruffle source under tag `v0.6.0`; **not downloaded as a runtime, built, or executed** |

The browser capability test proves only that a browser and WebAssembly are available. It does not supply an AVM1 interpreter. Likewise, a source tag is not a measured player version. No instrumented executable or compiled instrumentation patch was produced.

### 1.2 Concrete attempts and blockers

The installed-runtime search and direct launch attempts were followed by attempts to obtain an official Ruffle release, the Ruffle npm package, and an original Flash debugger archive. Container-side DNS resolution failed for their hosts. A separate browser attempt to open the Ruffle demo was blocked by the environment's administrator policy. Binary-download attempts through the download facility also failed; no runtime archive was obtained.

The reproducible command/browser diagnostics are in `evidence/environment_attempts.json`, recorded at `2026-09-29T03:31:36.279271+00:00`. Selected actual output:

```text
flashplayer <reference.swf>
  FileNotFoundError: No such file or directory: 'flashplayer'

ruffle <reference.swf>
  FileNotFoundError: No such file or directory: 'ruffle'

curl: Ruffle release / github.com
  exit 6: Could not resolve host: github.com

curl: Ruffle package / registry.npmjs.org
  exit 6: Could not resolve host: registry.npmjs.org

curl: Flash debugger archive / fpdownload.macromedia.com
  exit 6: Could not resolve host: fpdownload.macromedia.com

Chromium navigation to the Ruffle demo
  net::ERR_BLOCKED_BY_ADMINISTRATOR
```

These are local execution-environment observations, not evidence that the remote releases are unavailable or that the game is defective. Reading source pages through the research browser did not make executable runtime files available to the container. No attempt was made to bypass the administrator block or contact the historical score service.

**What unblocks the work:** an authorized environment with a preinstalled Flash runtime or a locally buildable, instrumentable Ruffle checkout and its dependencies. Repeating mocked opcode execution would not unblock it.

## 2. Reference SWF identity

The supplied file was read without modification. `tools/verify_reference.py` checks the hash, file size, uncompressed signature, bit-packed stage rectangle, frame rate, and root-frame count.

| Property | Expected | Observed from file bytes | Result |
|---|---:|---:|---|
| Signature | FWS | FWS | PASS |
| SWF version | 5 | 5 | PASS |
| Declared / actual size | 59,360 / 59,360 bytes | 59,360 / 59,360 bytes | PASS |
| Stage rectangle, twips | 0, 7000, 0, 5000 | 0, 7000, 0, 5000 | PASS |
| Stage dimensions | 350 × 250 | 350 × 250 | PASS |
| Nominal rate | 30 FPS | 30 FPS | PASS |
| Root timeline | 115 frames | 115 frames | PASS |
| SHA-256 | Reference below | Exact match | PASS |

```text
4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977
```

**Identity gate: PASS. Gameplay runtime gate: not executed.** Header dimensions describe the stage, not the native `_width` of the field object; they do not close R01.

The utility was separately checked against the exact file, altered bytes, truncated input, non-SWF input, a missing file, and an attempted overwrite of its own input. Those six utility checks passed; none is a gameplay test. The original hash remained unchanged. Outputs are `reference_identity.json` and `identity_utility_qa.json` in `evidence/`.

M0's report, constants inventory, evidence map, and 52 previously recorded mocked probes remain the baseline. Their file hashes are retained in `evidence/baseline_inventory.json`. No new mocked physics checks were counted toward M0.5.

## 3. Instrumentation method

### 3.1 Evidence classes

This report uses four deliberately separate classes: **FILE OBSERVATION** for newly measured bytes or environment output; **M0 EXPECTATION** for the existing static reconstruction; **SOURCE CORROBORATION** for Ruffle implementation reading; and **PROPOSED EXPERIMENT** for measurements not yet made. There is no **RUNTIME OBSERVATION** of the game in this delivery.

An unchanged SWF executed by a full Ruffle player would qualify as runtime evidence *for that Ruffle build*. It would not, by itself, prove exact equivalence with every original Flash Player. Any such compatibility assumption must be explicit in a later contract.

### 3.2 Smallest useful instrumentation surface

Use the original SWF as the root movie, without an ActionScript wrapper or SWF bytecode edits. Add an external observer to the runtime; retain its real action interpreter, display list, native properties, collision implementation, and timeline lifecycle. Use one shared sequence counter for all observations.

| Observer point | Measurement purpose | Source locator |
|---|---|---|
| Host input entry and full player-frame boundary | Timestamp input delivery and distinguish it from actual simulation advancement | `core/src/player.rs`: `handle_event`, `run_frame` [S3] |
| Executed action dispatch | Record which callback truly ran, not merely which was enqueued; separately log skipped actions | `core/src/player.rs`: `run_actions` [S3] |
| Original AVM1 instruction boundary | Snapshot selected state immediately around existing assignments and contact calls | `core/src/avm1/activation.rs`: `run_actions`, `do_action` [S1] |
| Native one-argument `hitTest` | Log resolved identities, installed transforms, script bounds, and actual Boolean result | `core/src/avm1/globals/movie_clip.rs`: `hit_test`; `display_object.rs`: `hit_test_object` [S2, S4] |
| Construction, Load, removal, and rewind | Determine persistent identity, cache retention, and handler reruns | `core/src/display_object/movie_clip.rs`: `run_frame_avm1`, `run_goto`, instantiation/removal paths [S5] |

This is an **instrumentation design**, not a delivered, tested Rust patch. Stock Ruffle launch flags alone do not produce these captures. The accompanying work order identifies the remaining implementation work instead of inventing a tracing command.

### 3.3 Capture integrity

Record original file offset and runtime buffer offset separately. Ruffle's action reader works with an internal movie slice [S1]; calibrate each slice to the exact original handler bytes before using M0's absolute offsets. Do not assume the offsets are identical or differ by a guessed constant.

Snapshots must distinguish logical state, root-published state, ball-local cached state, and installed display state. Include the tick/sequence at which each publication or cache changed. Use round-trippable numeric values; preserve `undefined`, `NaN`, infinities, and signed zero explicitly rather than replacing them with zero. Store raw twips/matrix values in addition to native property readbacks where possible.

Observers must not execute new ActionScript, refresh caches, invoke user getters, drain the action queue, or alter ordering. Give each native allocation a monotonic identity with a generation; names, depths, and potentially reused addresses are insufficient. Buffer logs to avoid slowing individual instructions enough to change host input delivery.

Separate ordinary-input sessions from injected boundary fixtures. A fixture may prepare state in the real runtime before an unchanged callback executes, but it must disclose every write and cannot prove natural human reachability. A replacement `hitTest`, hand-called callback, or Python recurrence cannot settle this gate.

## 4. R01 results — Native field dimensions and center

**EXPECTED FROM M0** [E01, E13; M0 §5]:

| Native or derived value | M0 expectation | Observed in a player |
|---|---:|---|
| Bounds `_width` | 301 | Not captured |
| Bounds `_height` | 201 | Not captured |
| L / R | 25 / 326 | Not captured |
| T / B | 25 / 226 | Not captured |
| Center X / Y | 175.5 / 125.5 | Not captured |

**OBSERVED:** Only the reference file's encoded geometry and stage header are available. The running bounds object was not instantiated. Ruffle's source obtains script width/height from script-mode bounds [S4], which identifies what to log but is not a measurement of this movie.

**RESULT: INCONCLUSIVE.** U01 remains open.

**IMPLICATION FOR NEW IMPLEMENTATION:** Keep native field dimensions provisional. Do not substitute the visually convenient 300 × 200 rectangle. Also do not confuse the outline's extent with the registration-based logical walls.

**Smallest missing observation:** Start a new game with a verified unscaled content transform and log the bounds object's registration, native width/height, raw script bounds, and the world values immediately after E01 initialization. Preserve all eight requested values in one record. Window size alone is not proof of an unscaled content viewport.

## 5. R02 results — Stationary centered serve

**EXPECTED FROM M0** [E09–E11; M0 §§7–8, 13–14]: After the player has actually settled at the measured center, the cached displacement is zero; an accepted first serve has the following expected changes.

| Quantity | Before | After serve / first active update |
|---|---:|---:|
| vx / vy / vz | 0 / 0 / 0 | 0 / 0 / `levelSpeed` immediately after serve |
| cx / cy | 0 / 0 | −0.01 / −0.01 |
| Score, fresh state | 0 | 100 |
| Accuracy bucket | 100 | 90 |
| Hit bucket | 100 | 100 |
| First subsequent logical movement | Center | x −0.01, y +0.01; z +`levelSpeed` |

At level 1, `levelSpeed` is 2. The click handler uses the ball's existing player cache; it does not resample paddle movement. A tiny logical movement need not produce a visible pixel displacement.

**OBSERVED:** No click reached a running original movie. Cached coordinates/displacements, event order, installed curves, score changes, and first movement were not captured.

**RESULT: INCONCLUSIVE.** The serve expectation and U04 are not dynamically confirmed.

**IMPLICATION FOR NEW IMPLEMENTATION:** Do not calculate serve spin from raw mouse velocity or recompute paddle displacement at click time. Preserve the distinction between logical movement and display readback, but leave the cache's runtime age unresolved.

**Smallest missing observation:** Log several settled player/ball callbacks; deliver one real host input event; capture E11 entry/exit and the next E10. Record exact cached x/y/dx/dy before the click. If pointer-coordinate granularity prevents the true center, disclose it and use a fractional-coordinate runtime input fixture as a separate case. Do not silently call a noncentered run “exact center.”

## 6. R05 results — Paddle boundaries and accuracy

**EXPECTED FROM M0** [E10–E11, E14–E15; M0 §§6, 9, 13]: An accepted contact earns accuracy exactly when both logical differences satisfy `abs(dx) <= 7` and `abs(dy) <= 5`. This classifier is distinct from the native display-box `hitTest`. Contact location does not add a Pong-style lateral impulse. A stationary paddle installs zero return curve while retaining the incoming vx/vy.

**OBSERVED:** No contact, native edge inclusion, accuracy award, outgoing velocity, or curve was measured. Reading Ruffle's object/object test path [S2, S4] is not an executed edge test.

**RESULT: INCONCLUSIVE.** U02 remains open.

**IMPLICATION FOR NEW IMPLEMENTATION:** Keep two separate decisions: display collision acceptance and logical accuracy classification. An inclusive logical score threshold does not establish an inclusive native collision edge.

**Smallest missing observation:** Use accepted, no-wall near-plane return fixtures. Vary one logical offset at a time while preserving a coherent pre-update display and a stationary paddle:

| Cases | x difference / y difference at classification | Expected accuracy, conditional on accepted contact |
|---|---|---|
| Center | 0 / 0 | Yes |
| Horizontal boundary | ±7 / 0 | Yes |
| Horizontal inside / outside | ±6.95 / 0; ±7.05 / 0 | Yes / No |
| Vertical boundary | 0 / ±5 | Yes |
| Vertical inside / outside | 0 / ±4.95; 0 / ±5.05 | Yes / No |
| Four accuracy corners | ±7 / ±5 | Yes |

For each case, log contact acceptance, score/bucket deltas, vx/vy immediately before and after response, and cx/cy. Repeat representative center/edge cases with the same nonzero incoming lateral velocity, accounting for movement before classification. Fresh stationary return fixtures should award accuracy plus the hit bucket when central, but only the hit bucket outside the accuracy band.

Then test actual native box contact: exact touching, one native twip inside, and one outside on both axes; include near- and far-plane scales. Measure the installed bounds rather than treating requested coordinates as readback. Add setter/readback samples around positive and negative sub-twip thresholds. Ruffle has twip conversions [S6], but that does not justify globally rounding every logical value or every display operation the same way.

## 7. R06 results — Wall response

**EXPECTED FROM M0** [E10; M0 §§7–9]: The affected curve first contributes to velocity, movement occurs, then ordinary decay divides curve by 1.004. Wall response clamps away overshoot, negates that velocity component, and divides the already-decayed curve by `((1.004 − 1) × 50 + 1)` (approximately 1.2). Curve sign is retained. A corner processes y before x.

**OBSERVED:** No wall or corner event was executed. There are no native before/after numbers or sound-event timestamps.

**RESULT: INCONCLUSIVE.** No contradiction with M0 was observed; agreement was not tested either.

**IMPLICATION FOR NEW IMPLEMENTATION:** Retain the existing M0 recurrence provisionally. Do not add residual reflected travel, negate spin on walls, or move wall attenuation before ordinary decay.

**Smallest missing observation:** In the real runtime, prepare a mid-depth ball at `x = measured R − radius − 0.25`, vx = 1, cx = 0.5, z = 35, vz = 2, with centered y and zero vertical motion. The next callback should overshoot the right wall, without reaching a paddle. For the corner variant also set `y = measured T + radius + 0.25`, vy = 1, cy = 0.25. These are proposed injected fixtures, not natural-play recordings.

Capture six phases: before integration, after integration, after movement, after ordinary decay, before wall response, and after response. For the corner, capture after y response and after x response separately. Use E10's existing instruction landmarks in `runtime_hook_map.json`. Record sound-start invocations separately from actual audio playback latency; only the former is needed to check logical event order here.

## 8. R08 results — Old display box versus new logical state

**EXPECTED FROM M0** [E10, E14–E15; M0 §§7, 9]: At a paddle-plane test the ball already has its newly advanced logical x/y/z, but the native collision call precedes that callback's display projection. The call should therefore use the previously installed ball display. The paddle display's age depends on R14. Accuracy subsequently uses new logical ball coordinates and cached logical paddle coordinates.

**OBSERVED:** Neither relevant native call was reached: enemy `0x00C490` or player `0x00C895`. The original file places late projection afterward, in `0x00D23F–0x00D3AE`; this remains M0 evidence, not new execution evidence. The Ruffle source path for an object/object test uses display-object script bounds [S2, S4].

**RESULT: INCONCLUSIVE.** The highest-priority part of U02 remains empirically open.

**IMPLICATION FOR NEW IMPLEMENTATION:** Do not replace the M0 old-display hypothesis with a current-logical-position collision. Keep both state representations available until a native trace establishes the actual collision inputs and outcome.

### Discriminating fixture prepared, not executed

The package includes `proposed_fixtures.json`. Its R08 case is deliberately away from an exact box edge and is labeled **ANALYTICAL_FIXTURE_NOT_EXECUTED**.

Use the measured center and a stationary near paddle. Prepare ball logical state `(Cx + 42, Cy, 1)`, with vx = 20, vy = 0, vz = −2, and zero curves. Install the display corresponding to that pre-update state through the runtime's real property path. Then execute the original callback normally. Before its contact call, the logical state should be `(Cx + 62, Cy, −1)`.

With M0's projection constant and nominal object sizes, the following are **calculated expectations before native quantization**, not observations:

| Collision input candidate | Ball x offset from paddle | Sum of horizontal half-widths | Predicted box relationship |
|---|---:|---:|---|
| Previously installed state at z = 1 | ≈41.140 | ≈44.693 | Overlap |
| Newly projected logical state at z = −1 | ≈63.270 | ≈45.307 | No overlap |
| New logical state, clamped to z = 0 first | 62 | 45 | No overlap |

The expected old-display branch accepts the return, clamps z to 0, reverses vz to +2, retains vx = 20, and grants no accuracy because the new logical x offset is 62. With fresh buckets and a stationary paddle it would grant the ordinary hit award only.

At the real `hitTest`, capture both installed boxes, transforms, identities, logical state, cached paddle state, and the returned Boolean. Calculate a counterfactual box separately without mutating the live ball. This fixture can establish an engine boundary behavior; it does **not** establish that its initial state is naturally reachable by human play. A normal-play crossing trace should accompany it.

## 9. R14 results — Runtime callback and input ordering

**EXPECTED FROM M0** [E04, E06, E08, E10–E11; M0 §14]: The internal order of each handler is known. The global order of player, enemy, depth marker, ball, and root actions is **not** established. MouseDown consumes the ball's previously cached player values.

**OBSERVED:** No gameplay callback sequence or input-to-update ordering was captured. There is no legitimate “Tick N: player, enemy, marker, ball” trace to report. Display depth, source comments, or an investigator-chosen callback loop would not supply one.

**RESULT: INCONCLUSIVE.** U03 and U04 remain open.

**IMPLICATION FOR NEW IMPLEMENTATION:** Do not freeze an arbitrary update schedule or interpret current mouse movement as the ball's consumed displacement. The age of the AI's root-published ball sample also remains dependent on the measured ordering.

**Smallest missing observation:** Instrument actual callback execution and publication/cache sites with one monotonic sequence. Capture at least ten consecutive complete runtime frames in settled serve and active rally. Run isolated input cases before and after a full update, and while the paddle moves. Record host arrival, dispatch, queue execution, player publication, ball cache refresh, MouseDown, and the next movement.

Count real runtime frames, not root `_currentframe` (which may be stopped) or render refreshes. The trace must show the source publication identifier consumed by the ball and by each click. A controlled driver may deliver events at complete-frame boundaries, but must use the runtime's input API and ordinary frame processing. It must not order the four callbacks itself. Repeat the input observations through the normal frontend to identify any additional host-delivery behavior.

The only structured sequence available in this pass is the **environment failure log** in §1. It is not presented as a game trace.

## 10. Secondary test results

### R10 — Score and time-bonus persistence

**EXPECTED FROM M0** [E02, E10–E12]: Serve waiting consumes no bonus; every 11 eligible active-ball updates remove 25. Player miss resets all four award buckets; a same-level enemy miss does not. Partial countdown progress survives same-level retry.

**OBSERVED:** No waiting interval, eligible update count, miss, or retry was measured.  
**RESULT: INCONCLUSIVE — NOT EXECUTED.**  
**IMPLICATION FOR NEW IMPLEMENTATION:** Preserve M0's reset scopes provisionally; do not label them runtime-verified.

Capture one waited serve, at least two decrement boundaries, and both miss types without ending the level. To expose partial-counter retention, cause a miss after a nonmultiple of 11 eligible updates. Log that the miss-detection callback is ineligible after vz becomes zero; do not accidentally count it.

### R11 — Timeline rewind and paddle retention

**EXPECTED FROM M0** [E03–E12; M0 §§3–4, 18–19]: Same-level retry returns to `Serve` (root frame 91); level advance returns to `Level` (frame 45). There is no explicit general retry recenter in the relevant actions. Actual instance retention, previous-position caches, and Load reruns are unresolved.

**OBSERVED:** No live instance identity or rewind was observed. Ruffle's rewind code discusses preserving appropriate instances [S5], but does not establish what happened to these particular paddle instances.

**RESULT: INCONCLUSIVE — NOT EXECUTED.** U05 stays open.  
**IMPLICATION FOR NEW IMPLEMENTATION:** Do not reset or retain all objects indiscriminately. Establish a per-object reset matrix from execution.

Leave the player off-center and record both paddles immediately before miss resolution, immediately around the root rewind, and after subsequent callbacks. Capture allocation identity/generation, placement frame, native and logical position, previous-position cache, displacement, Load count, and queued/skipped/executed actions. Repeat at a level transition. Never use the same instance name as proof of persistence.

Although R11 is labeled secondary in the test list, this delivery does not defer U05 out of scope. It is required before accepting a contract that includes the requested retry/instance-lifecycle behavior. R10 similarly gates score/progression acceptance.

### R12 — Post-level-10 behavior

**EXPECTED FROM M0** [E01–E02, E12]: The completion branch increments the level to 11, beyond ten defined difficulty entries. Its complete runtime consequence is unknown.  
**OBSERVED:** No completion or subsequent lookup executed.  
**RESULT: INCONCLUSIVE — OPTIONAL TEST NOT EXECUTED.**  
**IMPLICATION FOR NEW IMPLEMENTATION:** Treat campaign termination as an explicit later compatibility decision, not a reason to block initial physics work. An injected completion would test that path, not prove normal reachability. Keep the runtime offline.

### R13 — Stopped-miss click behavior

**EXPECTED FROM M0** [E10–E11]: MouseDown lacks a `ballStop` guard. M0's mocked local probe did not prove that a human click can reach the necessary overlap during normal miss animation.  
**OBSERVED:** No human or runtime-driver input during a miss was delivered.  
**RESULT: INCONCLUSIVE — OPTIONAL TEST NOT EXECUTED.**  
**IMPLICATION FOR NEW IMPLEMENTATION:** Do not promote the old mocked result to a demonstrated gameplay exploit. An intentional new click guard is a declared deviation, not a recovered original rule.

## 11. Updated uncertainty table

| ID | Subject | Status after this pass | Reason / closure condition |
|---|---|---|---|
| U01 | Native field width/height | **STILL OPEN** | File identity is confirmed; native object readback is absent. Close with R01. |
| U02 | Display quantization and hitTest edges/timing | **STILL OPEN** | Source paths and a discriminating fixture are identified; no native boxes/results were captured. Close with R05/R08. |
| U03 | Inter-clip EnterFrame order | **STILL OPEN** | No executed callback trace. Close with R14, including stable and transition frames. |
| U04 | MouseDown and cached-state timing | **STILL OPEN** | No actual event/cache provenance. Close with R02/R14. |
| U05 | Timeline instance retention | **STILL OPEN** | No identity-generation, Load, or cache-retention capture. Close with R11. |
| U06 | Post-level-10 behavior | **OUT OF SCOPE FOR INITIAL PROTOTYPE** | Still unverified; optional isolated R12 later. |
| U07 | Stopped-miss click reachability | **OUT OF SCOPE FOR INITIAL PROTOTYPE** | Still unverified; optional ordinary-input R13 later. |
| U08 | Legacy high-score server policy | **OUT OF SCOPE FOR INITIAL PROTOTYPE** | Offline prototype needs no historical service; no server request made. |
| U09 | Exact presentation/audio timing | **OUT OF SCOPE FOR INITIAL PROTOTYPE** | Audiovisual parity unmeasured. This exclusion does not defer physics callbacks or logical transition ordering. |

“Out of scope” does not mean resolved. “Still open” does not invalidate M0's static evidence. No U01–U05 entry was upgraded merely because corresponding source code was located.

## 12. Differences between static reconstruction and runtime behavior

**No gameplay difference can be reported because no gameplay runtime observation exists.** This is not a claim that differences do not exist.

| Item | Actual new evidence | Effect on M0 |
|---|---|---|
| Reference identity | Exact hash/header match | Baseline preserved |
| Installed runtime and acquisition | Absent runtime; unsuccessful acquisition; blocked browser demo | Explains incomplete execution gate, not a game behavior difference |
| Native test/measurement source locations | Ruffle source-only corroboration | More specific capture method; no new measured constant or schedule |
| R08 separating case | Analytical candidate with old/new overlap disagreement | Better proposed experiment; not a successful collision test |
| Mocked M0 probes | No new gameplay execution added | All prior limitations remain |

In particular, this report does **not** change the geometry to 300 × 200, infer an EnterFrame order from depth, assert an exact Flash quantization rule, or assert retention from a generic rewind comment.

## 13. Final simulation-contract recommendations

### Readiness decision

> Is the behavior now sufficiently verified to freeze a `Curveball Simulation Contract v1` for an independent browser implementation?

**NO.** The requested empirical minimum—R01, R02, R05, R06, R08, and R14—has no completed runtime observation. U05 also lacks the R11 observation needed for lifecycle acceptance. Calling this “YES, WITH EXPLICIT COMPATIBILITY ASSUMPTIONS” would conceal that none of the runtime gate was executed.

This is a decision about the evidence available **in this pass**, not about feasibility. M0 remains a substantial behavioral basis. A provisional engineering draft could be prepared from it, but should not be described as a newly verified frozen contract.

### What should remain unchanged in that provisional basis

Carry forward M0's 30 Hz discrete model; smoothed/clamped paddle displacement; acceleration before movement; ordinary curve decay before wall attenuation; y-before-x walls; strict depth crossings; preserved lateral velocity on paddle return; separate collision/accuracy decisions; late ball display projection; and independent score buckets. Do not rederive these rules unless a runtime result contradicts them. [M0 §§6–14]

Keep native geometry/readbacks, collision edge semantics, full callback schedule, input-cache age, and per-object rewind retention explicitly pending. Record contradictory traces rather than repairing them to agree with expectations.

### Minimum evidence needed to change the decision

Complete the six requested priority tests, then R11 for the requested lifecycle scope and R10 before score/progression acceptance. Attach the exact runtime build/version, reference hash, observer patch, launch configuration, inputs, and trace slices supporting each result. A visible window or a single successful rally is not equivalent to these measurements.

If only Ruffle is available, a later **YES, WITH EXPLICIT COMPATIBILITY ASSUMPTIONS** could name that exact tested build as the behavioral oracle and explicitly leave original-Flash equivalence unproven. That choice must follow actual observations, not replace them. U06–U09 need not block the initial offline physics contract when their scope exclusions are stated.

## 14. Remaining compatibility decisions

The next verified contract must make six choices explicit: the tested runtime oracle and version; the measured script-bounds/quantization policy; exact update and input-event order; cached-state age and old-display collision semantics; the per-object reset/retention matrix; and policies for undefined post-level-10 behavior, stopped-miss clicks, ranking, and presentation differences. No such choice is silently settled here.

### 14.1 Actionable continuation

Use `M05_Runtime_Capture_Work_Order.md` with the existing M0 package and the original reference file. It specifies observer locations, exact original action ranges, input/fixture separation, required trace fields, and acceptance conditions. `runtime_hook_map.json`, `capture_manifest.template.json`, and `proposed_fixtures.json` make that handoff concrete.

The only executable utility supplied is the tested, read-only file-identity checker. **This package contains no Flash/Ruffle runtime, compiled observer, recorded game trace, replacement game, converted ActionScript, or original game assets.** Further coding is needed to implement and build the observer in an authorized runtime environment.

### 14.2 Evidence files

| File | Role |
|---|---|
| `evidence/reference_identity.json` | Actual reference hash and metadata checks |
| `evidence/environment_attempts.json` | Actual launch, command, DNS, and browser diagnostics |
| `evidence/identity_utility_qa.json` | Utility-only positive/negative checks; not gameplay verification |
| `evidence/baseline_inventory.json` | Hashes of the retained M0 inputs |
| `runtime_results.json` | Explicit not-run/inconclusive status and null observations for each requested test |
| `runtime_hook_map.json` | M0 original-byte offsets mapped to proposed runtime observation sites |
| `proposed_fixtures.json` | Proposed test inputs and analytical expectations, clearly non-observational |
| `capture_manifest.template.json` | Empty provenance template for a future actual runtime capture |

### 14.3 Sources and attribution

**M0** refers to the supplied *Curveball — Original Behavior Specification*, its evidence index, and constants inventory. E-identifiers and original offsets preserve that baseline's conventions: absolute bytes in the original uncompressed file; interval ends exclusive; timeline frames one-based. The original M0 report is unchanged and is not duplicated in this package.

External source inspection on 2026-09-29 used the version-qualified Ruffle paths below. They establish source locations and limited implementation facts—not execution of Curveball. The exact Git commit and executable hash must be recorded by the later runtime operator; no build identity is inferred from the tag alone.

| ID | Primary source |
|---|---|
| S1 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/core/src/avm1/activation.rs` |
| S2 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/core/src/avm1/globals/movie_clip.rs` |
| S3 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/core/src/player.rs` |
| S4 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/core/src/display_object.rs` |
| S5 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/core/src/display_object/movie_clip.rs` |
| S6 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/swf/src/types/twips.rs` |
| S7 | `https://raw.githubusercontent.com/ruffle-rs/ruffle/v0.6.0/desktop/src/cli.rs` |
| S8 | `https://github.com/ruffle-rs/ruffle/wiki/Using-Ruffle` |

**Final status: reference identity confirmed; runtime acquisition/execution blocked; six priority tests inconclusive; U01–U05 still open; Simulation Contract v1 not ready to freeze on the basis of M0.5.**
