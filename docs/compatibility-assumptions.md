# M1 compatibility assumptions

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
