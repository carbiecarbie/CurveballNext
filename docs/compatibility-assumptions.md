# Compatibility assumptions

**Accepted M4 profile:** `m4-ruffle-06-01`, using the maintainer-authorized Ruffle v0.6.0 commit `cac5c99ce4a17e606f4ee3090389bb878f852055` as the provisional U01–U05 oracle. M4 is completed and accepted after independent review. CurveballNext matches this pinned runtime oracle for the verified/tested original-runtime behavior, except documented intentional containment and explicitly retained uncertainties; historical Adobe Flash Player equivalence remains unproven. See [current correction policy](#m4-correction-policy) and [M4 evidence, limits and closure review](milestones/m4-original-runtime-parity-closure.md#final-independent-review-and-closure).

## Historical M1–M3 selected policies

The following policies describe the accepted pre-M4 implementation. They are superseded where the current correction policy below says so.

### M1 compatibility assumptions (historical)

Profile: **m1-provisional-01**. All U01–U05 remain unverified in native Flash. Tests prove this candidate's selected behavior; none closes a native R test or freezes Simulation Contract v1.

| Question | Selected policy / owner | Fixtures and future closure |
|---|---|---|
| U01 field size | `compat/profile.ts`: registration (25,25), size 301 × 201; center (175.5,125.5) | T01 geometry. Replace profile after native R01. |
| U02 display and overlap | `compat/display.ts`, `core/collisions.ts`: identity binary64 installation, closed AABB including edge/corner; ball box replaced only after contact. Player readback commits to next movement; ball logical coordinates remain separate. | T02 readback double; T07 projection; T10 near/far old-box separating fixtures and inverses. Native R05/R08 required. |
| U03 callback order | `core/tick.ts`: due lifecycle → commands → player → enemy → ball → completed result. AI reads prior published ball. | T08/T12 publication age, T14 replay. Native R14 required. |
| U04 dispatch/cache | `runtime/input.ts`, `core/lifecycle.ts`: serve before actors using prior ball contact cache; no immediate AI publication. Reject invalid cache. Ordinary returns use this tick's published paddle displacement. | T03/T12 moving serves, ties, resets, late delivery and duplicate presses. Native R02/R14 required. |
| U05 retention | `core/lifecycle.ts`, `core/state.ts`: same-trial retry preserves paddles; fresh ball with invalid cache and stopped publication. | T13 reset matrix and T14 scenarios. Native R11 required. |

## Reset matrix

| Field | Same-trial retry | Hard reset / difficulty change |
|---|---|---|
| Player/enemy logical and previous positions | Preserve exactly | Center |
| Paddle displacement/publication/display | Preserve until ordinary actor step | Initialize centered, zero displacement |
| Paddle generations | Preserve | New trial generation |
| Ball position/motion/curve | Fresh centered ball, z=0, zero motion | Same |
| Ball display/generation | Install new centered box; increment generation | Same |
| Ball contact cache | Invalid until next ball handler | Same |
| Published ball | Fresh centered stopped sample | Same |
| Pointer target | Preserve | Center, then any subsequent commands |
| Rally returns | Clear | Clear |
| Trial returns/misses | Preserve | Clear |
| Global tick | Continue | Continue |
| Trial identifier | Preserve | Increment |
| Rally identifier within trial | Increment | Start at 1 |

Retry is a dispatch operation, with no extra actor update. In M2, Retry during MissHold is allowed only while both sides have lives remaining; a depleted side reserves the pending miss for resolution at missTick+19. That resolution retries, completes the level (enemy first), or enters Game Over as appropriate. Player/enemy handlers continue during MissHold; ball updates stop after the miss callback completes its late projection/publication. Serve attempts during MissHold are guarded deliberately under the M1 U07 policy.

## Host and numerical policy

Boundaries are epoch + tickOffset × 1000/30. Assignment chooses the first unprocessed boundary at or after the normalized sample timestamp, recording late reassignment. Samples within a tick sort by timestamp, then sequence for ties. Sequences identify arrival records and may be consumed out of sequence when delivery timestamps differ; duplicates are invalid. Canonical replay validates that ordering.

Five due ticks may run; six suspend before the batch. Blur/hiding/overload clears the pending live queue. Resume rebases host time and queues the latest valid mouse target, preserving paddle caches. Paused Step has no new gameplay commands. Host metadata is separate from core physics.

JavaScript binary64 arithmetic retains the stored decimals and degree-form projection expression. Strict collision comparisons have no tolerance. Numeric mathematical tests use absolute 1e-9 plus relative 1e-12 tolerance; strict replay compares values exactly with signed zeros treated alike. A measured Edge/Node projection difference of about 5e-15 prevents strict cross-engine comparison for the captured session, as permitted by the plan's cross-engine limitation. Same-engine captured replay passes. No alternate mathematical formula was substituted to erase this difference.

Interpolation, canvas size, DPR, recording and debug cannot write core state. There is one production compatibility profile, not an unresolved-behavior settings menu.

## M2 compatibility containment

The recovered original has ten defined difficulty tuples. On a level-10 enemy depletion it increments toward an undefined eleventh entry, with no verified final-victory branch. M2 awards the remaining level bonus once and enters `ContentComplete` at level 10 without indexing level 11. This is a **CurveballNext compatibility containment policy**, not recovered original behavior. `Winner` in the original belongs to historical high-score qualification. A future R12 runtime observation may replace this policy. The old M1 capture schema is rejected explicitly; M2 uses `curveball-m2-trace-2` with score, lives, award buckets, bonus and lifecycle state.

Debug level selection and forced misses are labeled developer fixtures. They use the original difficulty tuples and ordinary miss-resolution logic; normal New Game always starts at level 1. The original scoring and bonus resets follow `docs/original-behavior.md`. U01–U05 and the `m1-provisional-01` physics profile remain unchanged.

## Deferred questions

U06: native post-level-10 behavior remains unknown under the M2 containment policy. U07: original stopped-miss click reachability; U08: historical high-score service; U09: original audiovisual timing. None is resolved by omission. Native R10 scoring/bonus persistence is still unverified; M2 implements the M0 recovered rules. No recovered coefficient was tuned for subjective feel.

## M4 first runtime pass (historical, before oracle authorization)

The [M4 continuation](milestones/m4-original-runtime-parity-closure.md#continuation--actual-runtime-evidence) ran the unchanged original in headless Ruffle v0.6.0 at `cac5c99ce4a17e606f4ee3090389bb878f852055`. The real core interpreter, native hitTest/display list and timeline ran normally; input was delivered through PlayerEvent between complete frames, with null renderer/audio/network. Historical Flash equivalence remains unverified. M0/M0.5 remain historical reports.

| Question | Actual Ruffle observation | Next / remaining decision |
|---|---|---|
| U01 | Native width301/height201, registration(25,25), game logical center(175.5,125.5). Stroke bounds center(175,125) is distinct. | Logical geometry MATCH; native Flash equivalence open. |
| U02 | Closed native edges, one-twip outside rejected; twip/f32 display installation; R08 old installed ball box confirmed. | Old-box behavior MATCH; identity display/four far exact-touch cases diverge. Quantization/Flash policy open. |
| U03 | ball → marker → enemy → player; ball consumes prior paddle publication, enemy current ball publication. | Next player→enemy→ball/prior-ball AI differs. Flash order open. |
| U04 | Normal MouseDown synchronously consumes existing ball-local cache; exact ordinary source-write generation captured. | Measured-cache mechanism MATCH; moving-input cache/spin/score diverge. Flash/asynchronous host timing open. |
| U05 | Retry retains both paddles, replaces ball at next placement frame. Level transition retains player, reconstructs enemy/ball. | Same-level retention MATCH; availability/level player retention diverge. Native rewind decision open. |

Directly encoded serve minimum curve, outgoing lateral-velocity retention, inclusive ±7/±5 accuracy, wall response, award reset scope and eligible-update bonus cadence were dynamically confirmed from the tested states. R10 combines ordinary waiting/cadence with disclosed forced misses/retained partial counter; no full natural campaign is claimed.

The only code correction changes intra-wall assignments to clamp → curve attenuation → velocity reversal. Selected original instruction observations establish this order independently of cross-clip scheduling. All four branches now compare MATCH; the M3 order failed the observation regression. Final state values/events, equations, coefficients and replay schema are unchanged. See [before/after evidence](evidence/m4-wall-order-correction.json).

R12 injected world.level10/enemyLives1 into a level-1 session, with cached difficulty1 unchanged and a disclosed forced enemy miss. Normal runtime advanced11 and loaded undefined difficulty fields. This is not natural level10 reachability or undefined-motion playability evidence; Next's declared `ContentComplete` policy remains unchanged. U06 natural behavior, U07 stopped-miss clicks, U08 service and U09 audiovisual timing remain open.

[Derived observations](evidence/m4-ruffle-observations.json) and [component comparison](evidence/m4-comparison.json) retain special-value tags, exact discrete/collision comparisons and the existing mathematical tolerance. Native display precision is distinguished from transcendental cross-engine differences; no tolerance was widened. The provisional profile is not frozen, and no U01–U05 historical Flash-equivalence claim is closed.

## M4 correction policy

The maintainer explicitly adopted the pinned build as a provisional runtime oracle. This permits scoped U01–U05 closure against that build, rather than a native-Flash claim. The correction corpus contains 63 genuine original executions: four ordinary-input sessions and 59 disclosed controlled fixtures. All first-pass 55 sessions repeated exactly in derived state, events, order, input and provenance. No fixture is described as naturally reachable gameplay.

| Question | Current policy / measured scope | Status against pinned oracle |
|---|---|---|
| U01 | Logical registration (25,25), field301×201, center(175.5,125.5); distinguish visual stroke center(175,125). | RESOLVED, R01 MATCH |
| U02 | Original axis-aligned display position truncates to twips; float32 scale transforms centered encoded bounds, rounding ties to even. Closed AABB operates on the previously installed ball and paddle boxes. Logical player/enemy position, previous position and displacement never feed back from native display readback. Mouse readback at the measured scale1 viewport uses device pixels. | RESOLVED for measured shapes/input mapping, R05/R08 MATCH |
| U03 | Commands dispatch before normal actor actions; ball → cosmetic marker → enemy → player. The deterministic core omits marker logic but audits actual ball/enemy/player calls. Ball samples prior paddle publications; enemy reads current completed ball publication. | RESOLVED for complete recorded frames, R14 MATCH |
| U04 | MouseDown consumes the cache written by the preceding ball callback, whose paddle samples can be a frame older. Returning contact reads the prior paddle publication sampled in its ball frame. No host dispatch-time cache refresh. The integer moving-input score100 regression now agrees with the original. | RESOLVED within between-frame input evidence, R02/R14 MATCH |
| U05 | Same-level rewind retains paddles/target/previous state; ball unavailable at resolution, Load+1, first callback/cache+2. Level advance retains and updates player/target; setup resets awards/bonus+45, enemy Load+46, ball Load+47, first ball callback/cache+48. Root ball publication persists through removal/Load. | RESOLVED for measured retry/level transition consequences, R11 MATCH |

The far exact-touch discrepancy had interacting causes: the old implementation advanced the enemy first and installed a nominal undersized binary64 box before contact. Correct ball-first order preserves the prior native box, and the general twip/float32 policy installs the native15×10 far paddle for subsequent contacts. No fixture-specific exceptions or collision tolerance were added. Six additional depths and even/odd fractional mouse ties validate the general rule. Native bounds/readback compare exactly; logical math retains abs1e-9+rel1e-12. Input/view scaling outside the captured350×250/scale1 scope and arbitrary transforms are not proven.

State retains numeric actor placeholders for deterministic serialization, with explicit availability and scheduled Load ticks. Removed actors cannot collide/serve/update. Fresh ball Load leaves its cache null and the previous root publication intact until the next ordinary callback. A stopped original ball callback on the resolution frame has no game-state effect; the core need not recreate that no-op or timeline machinery. The independent intro screen still uses45-tick progress while gameplay readiness follows the observed+47 Load/+48 cache. Developer Retry remains an explicit immediate replacement fixture, separate from automatic original rewind.

`m4-ruffle-06-01` replaces the old replay profile; `curveball-m2-trace-2` remains the envelope. New availability/schedule validation accepts the measured one-generation-old root publication only during the fresh Load boundary with no cache, and rejects malformed schedules, stale active publications and caches on absent balls. Old-profile captures cannot silently replay under changed semantics. Mathematical tests with an explicit identity input adapter still test the static smoothing equation; they are not runtime observations.

R06 clamp → attenuation → reversal is preserved, including y-before-x and its original instruction regression. R10 award resets, waiting,11-update bonus cadence and partial retry-counter persistence match. R12 remains **INTENTIONAL CURVEBALLNEXT CONTAINMENT**: injected completion in the original advances11 and later requests undefined difficulty, with natural reachability/playability unestablished. CurveballNext awards the bonus once and ends at level10. This is not a defect to remove.

U06 natural post10, U07 stopped-miss/early-Load clicks, U08 historical service and U09 exact audiovisual timing remain open. Guards for invalid/absent caches and MissHold inputs remain deliberate containment outside the verified input scenarios. The renderer/audio backends were null; no original audiovisual timing was measured. All U01–U05 historical native-Flash equivalence remains a compatibility assumption, and Simulation Contract v1 is not silently frozen. See [root-cause evidence](evidence/m4-correction-pass.json) and [complete comparison](evidence/m4-comparison.json).
