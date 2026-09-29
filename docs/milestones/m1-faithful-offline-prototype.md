# M1 — Faithful Offline Prototype

**Project:** CurveballNext  
**Document date:** 29 September 2026  
**Status:** Implementation plan ready for review and handoff; implementation has not started.  
**Requested baseline:** `main`, commit `862cece` — `Initialize CurveballNext research baseline`  
**Compatibility profile:** `m1-provisional-01`  
**Contract status:** An explicit provisional implementation target, **not** a runtime-verified Curveball Simulation Contract v1.

## 1. Purpose

Build the smallest useful independent desktop-browser prototype that can answer:

> Do the recovered movement, curve, projection, collision, and opponent rules already produce Curveball's characteristic rally feel?

The deliverable is a playable offline rally laboratory, not a campaign, finished game, Flash emulator, or multiplayer foundation. Preserve recovered behavior even where a conventional physics engine would make different choices.

### Sources and decision authority

**[M0]** `Curveball — Original Behavior Specification`, supplied as `Curveball_Original_Behavior_Specification.md`; expected repository counterpart: `docs/original-behavior.md`. Gameplay references below identify its sections and evidence identifiers, such as E10. Its mathematical reconstruction is the primary reference. Its confidence label CONFIRMED describes static evidence, not successful execution in Flash.

**[M0.5]** `Curveball — M0.5 Runtime Verification Report`, supplied as `Curveball_M05_Runtime_Verification_Report.md`; expected repository counterpart: `docs/runtime-verification.md`. In particular, §§8–13 preserve U01–U05 as unresolved. The R08 separating fixture is analytical, not a captured native-runtime test.

**[Brief]** The supplied M1 request specifies repository baseline, scope, constraints, and acceptance goals. **[Boundaries]** `docs/project-boundaries.md` must be read in the actual checkout before implementation. Its separate contents were not available for direct inspection in this planning pass; this plan follows the clean-implementation restrictions reproduced in the brief and M0. Do not assume there are no additional local requirements.

Use this order of authority: project boundaries for permitted material; M0 for established gameplay rules; M0.5 for limits on verification claims; this plan for expressly selected M1 scope and provisional policies. A conflict is reported and resolved, not silently normalized.

The exact original reference identity recorded by the research is SHA-256 `4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977`. M1 neither loads that file nor requires it to run or test. No further SWF inspection is planned.

## 2. Acceptance boundary

A user can start a local browser session, choose a recovered difficulty, move the near paddle with the mouse, serve by a primary-button press while the installed paddle and ball boxes overlap, rally against the AI, generate curved shots, observe wall responses and either side missing, and continue without reloading the page.

| Include in M1 | Deliberately defer |
|---|---|
| Fixed 30 Hz movement, displacement, ball recurrence, curves, walls, strict plane crossings, AI, projection, installed collision proxies | Gameplay modernization and native-runtime parity certification |
| All ten difficulty tuples as data; a simple selector; required validation at levels 1, 5, and 10 | Automatic campaign progression, terminal behavior after level 10 |
| Serve waiting, rally, stopped miss, automatic retry, manual retry, hard trial reset | Original life totals, game-over flow, menus, score submission |
| Rally-return and session-miss counters; diagnostic accuracy and curve categories | Numeric scoring, depleting score buckets, time bonus, high-score persistence |
| Newly drawn minimal court, paddles, ball, depth cues; optional visual interpolation | Original assets, audio, animations, branding treatment, final artwork |
| Headless deterministic tests, input replay utility, local trace export, browser smoke checks | Network services, public deployment, extensive browser automation infrastructure |

The counters are labeled **diagnostics**, not original score or lives. Accuracy and curve classifications are retained because they expose contact semantics at very low cost; they do not grant points.

This deliberately removes the score/life/progression reset surface from M1. It does not rewrite the research or claim those systems are absent in the original. Scoring/progression implementation and R10 validation belong in M2 or a separately accepted milestone. [M0 §§11–13; Brief, Scoring and progression]

Acceptance has two independent parts: mathematical/architectural conformance and actual browser playability. Passing unit tests alone is insufficient. A maintainer's positive feel assessment is useful evidence, but is not proof of native Flash parity.

## 3. Starting repository state

The supplied baseline is `D:\Projetos\CurveballNext`, branch `main`, short commit `862cece`, with a clean working tree. This is user-provided state, **not a live checkout verification performed here**.

Existing expected files are `README.md`, `.gitignore`, and the three documents under `docs/`. `reference-local/curveball.swf` is a private, Git-ignored reference. Empty `src/` and `tests/` directories need not be tracked by Git.

Before any coding, the implementing agent must verify the branch, full commit resolved from `862cece`, empty index, clean checkout, and document contents. Stop on an unexpected baseline or unrelated changes; do not reset, clean, stash, or overwrite them automatically. If this plan has subsequently been committed, use an explicitly supplied successor baseline rather than treating an unexpected HEAD as authorized.

Read the three local documents and README before scaffolding. Confirm the M0/M0.5 counterparts contain the research used here; document meaningful differences. If a required document is missing, obtain or restore the approved document before implementation, not a newly invented substitute.

Extend the repository in place. Do not run a destructive scaffold over its documentation, replace its Git history, import another project, or open the SWF to generate code. Nothing in this plan authorizes a commit or push.

## 4. Technical stack

| Choice | Decision and boundary |
|---|---|
| Language | TypeScript with strict checking; ordinary numeric state and explicit types |
| Frontend | A single HTML entry, CSS, and vanilla TypeScript; no UI framework |
| Tooling | Vite, locally installed development dependencies, npm lockfile |
| Presentation | Canvas 2D plus ordinary DOM controls/debug text |
| Testing | Vitest in a Node environment for core, scheduler, mapping, and replay tests |
| Simulation | Exactly one recovered discrete update per 1/30 second of active simulation time |
| Rendering | `requestAnimationFrame` drives presentation and wakes the fixed-step scheduler |
| Quality gate | Explicit TypeScript type-check and deterministic tests; no separate lint framework required in M1 |

The project does not need a game engine or 3D renderer: the recovered depth function and the two display boxes are explicit parts of the behavior. An engine would add machinery without removing the fidelity work.

At planning time, Vite's official guide lists Node 20.19+ / 22.12+ requirements; Vitest's current guide is stricter and lists Node >=22.12.0 and Vite >=6.4.0. Select mutually compatible stable versions and a suitable Node version satisfying the combined requirements, record the actual versions, and lock them. Do not select Node 20 merely because Vite alone permits it. Use exact direct dependency versions and `package-lock.json`; include Node types if the configuration/test TypeScript requires them. [W1, W2]

**Offline definition:** after dependencies have been installed and the project built, playing and reloading the production build requires no internet connection or external service. Serve `dist/` over a loopback HTTP server using Vite preview for local verification. Double-clicking an HTML file through `file://`, an installable PWA, and a packaged executable are not acceptance requirements. Initial dependency installation can require internet access. Vite preview is a local preview tool, not a proposed public production server. [W3]

There is no application backend. Vite's local development/HMR plumbing is tooling, not game networking; the production build must contain no gameplay socket or external request dependency.

### Protect the local reference

Keep `reference-local/` Git-ignored, outside the module graph, and outside distributable assets. Configure `publicDir: false` for this procedural-art prototype. Keep Vite's filesystem restrictions and default sensitive-file exclusions, and add deny rules for `reference-local` and SWF files. Add no loader/plugin that reads those files. Verify direct requests do not return reference bytes.

This is defense in depth, not a claim that Git ignore controls HTTP access. Vite documents that its deny list does not filter public-directory files and that alternative plugin paths need separate care. Review both source inputs and `dist/`; do not rely on a deny glob alone. [W4]

## 5. Proposed architecture

Use small typed modules, not a MovieClip/timeline model, ECS, plugin framework, or universal game engine.

| Concern | Responsibility | Must not own |
|---|---|---|
| Core state and tick orchestrator | Authoritative state, ordered phases, lifecycle decisions, domain events | DOM, wall-clock time, Canvas, external I/O |
| Player step | Easing, clamp, committed near-paddle position, measured displacement | Raw mouse velocity or render interpolation |
| Enemy step | Follow/recenter law, logical clamp, displacement publication | Prediction, random error, direct access to future ball state |
| Ball step | Cached contact inputs, recurrence, wall/plane resolution, late publication | Browser callbacks, UI controls |
| Projection | Recovered pure mathematical mapping | Frame scheduling or image drawing |
| Compatibility profile/display adapter | Provisional dimensions, display installation/readback, AABB edge semantics, named ordering/retention decisions | Unexplained gameplay tuning |
| Host clock | Convert active elapsed time into due fixed ticks; explicit suspension | Changing per-tick physics constants |
| Input adapter | Normalize mouse coordinates and enqueue ordered commands | Mutating paddles, balls, or collision boxes |
| Presentation | Draw read-only snapshots and controls | Defining collision geometry from pixels or strokes |
| Trace/replay | Record returned observations; export/replay canonical tick commands | Changing outcomes or reading the SWF |

The core transition receives state, the already assigned commands for one tick, and an immutable compatibility profile. It returns next state, ordered domain events, and compact audit data. All state changes pass through that transition. A straightforward pure-function design is preferred; it makes replay and accidental mutation tests inexpensive.

**Authoritative state must include more than ball position:** tick number; trial/rally identifiers; selected difficulty; lifecycle phase and miss tick; last accepted pointer target; player/enemy positions and previous-position caches; measured displacement and publication stamps; ball position/velocity/curve; contact-cache validity and copied paddle samples; published ball sample; installed ball/player/enemy display states with stamps; diagnostic counters.

Installed display state belongs to the deterministic model because it affects collision. Interpolated visual state does not. Host pause status, render alpha, CSS size, device pixel ratio, and recording controls are outside the model.

Keep the profile immutable during a trial. A future compatibility change creates a new profile identifier and new expected compatibility fixtures. Do not add a settings panel containing every unresolved Flash behavior.

## 6. Simulation ownership and tick model

### 6.1 Provisional phase order

For tick `n`, use the following explicit order under `m1-provisional-01`:

| Phase | Operation | Information consumed |
|---|---|---|
| 0 | Settle a due automatic retry | The miss tick and current lifecycle state |
| 1 | Dispatch assigned commands in order | Previously installed boxes and the last completed ball contact cache for a serve |
| 2 | Update player; install display; publish position/displacement | Latest pointer target produced by this tick's commands |
| 3 | Update enemy; install display; publish logical position/displacement | Last **published** ball sample, not the just-served ball's unpublished local velocity |
| 4 | Run ball handler, including waiting-serve updates; or skip if stopped | Newly published paddle samples; old installed ball box |
| 5 | Return ordered events, audit data, and completed snapshot | Results of the preceding phases |

This is a **chosen schedule**, not a recovered callback trace. M0/M0.5 do not establish whether player-before-ball is more native-faithful than ball-before-player. This schedule is selected to make both paddle publications available to a ball update while retaining an explicit prior ball sample for AI. It introduces no prediction or additional arbitrary delay. [M0 §14.2; M0.5 §9]

Under this profile, an ordinary return on tick `n` uses the displacement published on tick `n`. A serve command at the start of tick `n` uses the cache written by the last completed ball handler, normally tick `n-1`. These are intentionally different paths.

On a serve, set local ball motion but do not immediately update `publishedBall`. The enemy therefore still sees the waiting sample during that tick; it sees the launched sample after the next ball publication. Refresh the ball contact cache at the start of every non-stopped ball handler, including waiting serve. Copy values; do not retain mutable references to paddle state. [M0 §§7.2, 10, 14.2]

The cosmetic depth marker is drawn from presentation snapshots. Its unknown native callback order is not recreated and cannot affect collision.

### 6.2 Fixed scheduler

Use a monotonic host time origin and integer completed-tick count. Nominal tick boundaries are `epoch + k × 1000/30` milliseconds; calculate boundaries from the origin/count rather than repeatedly adding a rounded 33 ms.

On each rendering callback, find how many boundaries are due. Execute **all due ticks up to five**, chronologically, with each tick's own input batch. A 15 Hz render stream can consequently execute two simulation ticks per rendered frame; a 144 Hz stream often executes none. Physics receives no delta parameter. Use testable timestamp arithmetic with a specified boundary convention, not frame-count division by assumed display refresh.

**Overload policy:** if more than five ticks are due, suspend before executing that overdue batch. Do not silently discard excess ticks and continue, accelerate the ball, or jump positions. Retain the last completed core state, clear pending live gameplay commands, report `timing-overrun`, and require explicit Resume. Rebase the host epoch on resume. This is a declared host policy, not original Flash behavior.

Pause similarly on document hiding or window blur. Hidden elapsed time does not become a catch-up rally. A dedicated Resume control must not also serve. On resume, accept the latest valid mouse position as a new target for normal easing; never rewrite previous-position caches or synthesize mouse displacement. Paused clicks are discarded. Retain host suspension records separately from gameplay ticks.

While paused, only Resume, one-tick debug Step, view controls, and export are enabled. Step executes one ordinary tick with no new gameplay commands and the last accepted target. Repeated key events must not cause extra steps. Reset/retry/difficulty commands are disabled until resumed.

A fixed-tick model does not promise that an overloaded or suspended browser executes real-time work at 30 Hz. The promise is exact discrete updates while active, render-rate independence under the stated budget, and explicit suspension rather than hidden timing changes. Animation-frame APIs supply rendering callbacks/timestamps, not the game's authoritative clock. [W5]

### 6.3 Numerical policy

Use ordinary binary64 JavaScript numbers. Preserve M0's stored decimals and arithmetic order, including the degree-form projection expression, player division by 1.5, and `(1.004 - 1) × 50 + 1`. Do not replace speed decimals with fractions, normalize vectors, or snap tiny curve values to zero.

Use strict comparisons where M0 does. Comparison tolerances belong in numerical tests, **never** in gameplay collision inequalities. Replay equality treats signed zero as equivalent; nonfinite state is rejected as an implementation error. Do not promise cross-engine bit identity, particularly at transcendental projection boundaries.

## 7. Input model

Use Pointer Events filtered to the primary mouse pointer, with primary-button **down** as the serve request. Do not listen to both pointer and compatibility mouse events and accidentally serve twice. Holding a button produces no automatic repeat; release does not serve.

The canvas is a 350 × 250 logical stage displayed at a uniform CSS scale. Convert viewport mouse coordinates using the canvas's content rectangle:

`stageX = (clientX - contentLeft) × 350 / contentWidth`  
`stageY = (clientY - contentTop) × 250 / contentHeight`

Keep borders/padding on an outer wrapper so the content rectangle has an unambiguous mapping. Do not multiply input by device pixel ratio. Do not clamp the mouse target to paddle-center bounds before easing.

While the game is focused, window-level mouse movement may provide targets outside the canvas; retain those absolute stage coordinates and let the player step clamp its own result. If no new sample is received, retain the last target. A serve press must originate inside the canvas; toolbar/button interactions cannot serve. Cursor warping and pointer lock are not included.

### Timestamp and command contract

Each normalized record has a monotonic sequence, host/sample timestamp, assigned simulation tick, command type, and applicable stage coordinates. Gameplay command types are pointer target, primary down, retry rally, and reset trial with a validated difficulty. A primary-down record also updates the pointer target for the upcoming player step, but does **not** move the paddle before evaluating the serve.

Assign an event to the first unprocessed tick boundary at or after its normalized timestamp. At exact equality, it belongs to that boundary if the tick has not run. Order equal-time events by sequence. If a sample arrives too late for its nominal tick, assign it to the next unprocessed tick and record the lateness; never roll back or rewrite an executed tick.

Do not feed the latest available mouse position to every overdue catch-up tick. Each tick consumes only the records assigned to it. Within a batch, moves update the held target; button/reset commands keep their order and are never coalesced away.

Feature-detect coalesced pointer samples: use the coalesced list when available, otherwise the dispatched move sample. Do not process both as independent duplicate movement. Never use predicted events. Browser delivery/coalescing can differ even for similar physical mouse motion; deterministic replay is promised for the same **canonical tick-command log**, not for two human gestures on different browsers. [W6]

Resetting a trial or replacing a ball invalidates its contact cache. A primary-down command encountered before the fresh ball's first ordinary cache-populating handler is rejected with `cache-not-ready`; it is not saved for a later auto-serve. This is an explicit M1 startup convention under U04, not a claim about pre-first-frame Flash input.

After pause or loss of focus, discard queued presses and moves rather than redispatching them against a later rally. Viewport changes affect only future coordinate conversions; already normalized records retain their stage coordinates.

## 8. Player paddle model

The near paddle has base dimensions **60 × 40** and depth zero. The selected U01 field produces center `(175.5, 125.5)` and legal paddle centers `x ∈ [55, 296]`, `y ∈ [45, 206]`. Derive these from field geometry, never duplicate them as unrelated constants. [M0 §§5–6; E03–E04, E13–E14]

For each coordinate, calculate:

`candidate = currentPosition - (currentPosition - pointerTarget) / 1.5`

Clamp y, then x, to the legal center intervals. Pass the position through the compatibility display-install/readback adapter. With the M1 identity adapter, the committed position equals the clamped candidate. Measure displacement from that committed position to the stored previous position, then update the previous-position cache and publication stamp.

The adapter seam matters: later evidence about quantized Flash near-paddle display readback may affect the position used on the next update and the measured displacement, not merely the rendered outline. Keep that possibility isolated. Do not globally quantize ball logical position as a side effect of changing display behavior.

A centered paddle moving toward `(205.5, 110.5)` must become `(195.5, 115.5)` with displacement `(20, -10)` after one update. A fixed unclamped target reduces the remaining error to one-third per tick. Continued dragging beyond a reached clamp produces zero displacement rather than accumulating hidden movement. [M0 §6.1]

Do not use raw mouse movement, elapsed-time velocity, an extra speed limit, mass, friction, prediction, or impact-position rebound angles. Initial construction centers position and previous position and sets displacement to zero. Same-trial retry preservation is defined separately in §13.

## 9. Ball/curve model

The ball state contains logical `x/y/z`, velocities `vx/vy/vz`, and curve accelerations `cx/cy`. Fresh-ball construction puts it at the field center and `z = 0`, with every velocity and curve component zero. Base diameter is 30; wall radius is always 15, independent of visual scale. [M0 §§5.4, 7; E09–E10]

### Preserve the internal handler order

For every non-stopped ball tick, including waiting serve:

1. Copy published player/enemy positions, displacements, and provenance into the contact cache.
2. Add `cx` to `vx`, then `cy` to `vy`.
3. Advance `z` by `vz`, `x` by the new `vx`, and **subtract** the new `vy` from `y`.
4. Divide each nonzero incoming curve component by `1.004`.
5. Resolve y walls, then x walls.
6. Test the strict far crossing, otherwise the strict near crossing, using the **previously installed** ball box.
7. Apply accepted-return or miss response.
8. Project/install the resulting ball display state, then publish logical ball position/velocity.

The original score/time-bonus operation following publication is deliberately absent from M1, not moved earlier. A miss stops future ball handlers but **does not abort** the current handler before its final display installation/publication. [M0 §7.2; E10]

The free-flight equations are:

`vx' = vx + cx; vy' = vy + cy; z' = z + vz`  
`x' = x + vx'; y' = y - vy'`  
`cx' = cx / 1.004; cy' = cy / 1.004`

These are per-tick recurrences, not differential equations to be re-integrated using variable delta time.

### Curve installation and returns

| Contact | New curve | Other motion response |
|---|---|---|
| Player return | `cx = -player.dx / C`, `cy = player.dy / C` | Set z to 0; negate vz; retain the current vx/vy |
| Enemy return | `cx = enemy.dx / C`, `cy = -enemy.dy / C` | Set z to 75; negate vz; retain the current vx/vy |

Replace the old curve; do not add to it. The incoming curve has already decayed and may have been wall-attenuated; the newly installed curve is neither integrated nor decayed again until the next ball update. No paddle-offset lateral impulse is added. [M0 §§8.1, 9.5]

### Serve-specific floor

After a legal serve installs player curve, independently replace any component whose magnitude is **strictly less than 0.01**:

- For x, use `+0.01` when cached player x is left of field center; otherwise `-0.01`.
- For y, use `+0.01` when cached player y is below field center; otherwise `-0.01`.

Values of exactly ±0.01 are unchanged. Ordinary returns do not receive this floor. Set positive depth velocity to the selected table speed. Do not immediately publish this change to the AI. Fresh-ball lateral velocity stays zero because of construction, not because every click forcibly resets lateral motion. [M0 §8.4; E11]

A centered, stationary, cache-ready serve has curve `(-0.01, -0.01)`; its first active update moves x left by 0.01 and y down by 0.01. This is a deterministic fixture expectation, not a promise about any arbitrary human click.

There is no gravity, curve cap, lateral-speed cap, normalization, rally-speed escalation, or invented use of dead variables such as `m`, `f`, or global `bounce`.

## 10. Wall/collision model

### 10.1 Logical walls

Use the logical radius 15 and these strict conditions, in order:

| Branch | Detection | Corrected coordinate | Affected components |
|---|---|---|---|
| Top | `y - 15 < T` | `y = T + 15` | Negate vy; divide cy by wall divisor |
| Otherwise bottom | `y + 15 > B` | `y = B - 15` | Negate vy; divide cy by wall divisor |
| Left | `x - 15 < L` | `x = L + 15` | Negate vx; divide cx by wall divisor |
| Otherwise right | `x + 15 > R` | `x = R - 15` | Negate vx; divide cx by wall divisor |

The wall divisor is evaluated as `(1.004 - 1) × 50 + 1`, approximately 1.2000000000000002. Curve sign is preserved. Free-flight decay occurs first. Discard overshoot by clamping; do not reflect leftover travel, iterate multiple rebounds, or apply a restitution parameter. Exact wall touching does not bounce. [M0 §§8.3, 9.1; E10]

A corner can produce a y event then an x event in one update. A subsequent successful paddle contact overwrites the wall-attenuated curve, but retains the reflected lateral velocity. A subsequent miss zeros all velocity and curve. Preserve the ordered events for diagnostics.

### 10.2 Installed display boxes

Represent each box by its installed stage-space center, width/height, derived min/max edges, and installation stamp. Sizes are based on the documented 30 × 30 ball and 60 × 40 paddles, projected at the corresponding depth. The appearance of a new stroke, glow, cursor, or diagnostic overlay must not alter those bounds.

M1 uses **unquantized closed axis-aligned bounding boxes**. Boxes overlap when their closed x intervals and closed y intervals intersect; exact edge/corner touching counts as overlap. Add no epsilon or hitbox padding. The unquantized representation and inclusion decision are provisional U02 choices, not native-runtime observations.

During a ball step, retain its old installed box until after wall/plane processing. The chosen U03 order means the tested paddle box has already been installed during that tick. A render interpolation snapshot is never the source of either box.

Future display compatibility may change installation rounding, bounds construction, edge inclusion, or player-position readback through the adapter. It must not change the core ball recurrence. Do not build a generalized Flash display hierarchy to support this seam.

### 10.3 Depth gates and responses

After movement and walls, test `z > 75`; otherwise test `z < 0`. There is no test at exact equality, no ball-radius depth slab, no direction guard, and no continuous crossing solver. Test the appropriate paddle's installed box against the old ball box. [M0 §9.2]

On success, clamp z to the contacted plane and apply §9's return. Do not clamp logical x/y to the paddle or reposition the ball to the apparent visual contact point.

On failure, retain logical x/y and out-of-plane z, clear vx/vy/vz/cx/cy, emit exactly one side-specific miss, and enter stopped miss. Finish the current late projection/publication. Future stopped ticks cannot re-count the miss.

### 10.4 Acceptance versus classification

After an accepted player contact or serve, evaluate accuracy separately using the logical ball x/y and **cached logical** player center: inclusive ±7 horizontally and ±5 vertically. Classify the newly installed curve as SUPER when both magnitudes exceed 0.10, otherwise CURVE when either exceeds 0.05, otherwise NONE. These are diagnostic fields only. [M0 §§6.3, 8.5]

An accepted display-box hit can fail accuracy. In particular, the old-box R08 fixture must remain an accepted return even though its new logical x offset is 62. Never use the accuracy rectangle as the paddle collision rectangle.

## 11. Projection/render model

Use the stored values `A = 31.066017` and `pi = 3.141592653589793`, with M0's expression order:

`g(z) = [90 - atan(z / A) × 180 / pi] / 90`

`screenX = centerX + (x - centerX) × g(z)`  
`screenY = centerY + (y - centerY) × g(z)`  
`width = baseWidth × g(z); height = baseHeight × g(z)`

The player is at z = 0, enemy at z = 75, and ball at its logical depth. Use the ball's saved diameter for both dimensions. Do not replace A with an exact trigonometric construction, force the far scale to exactly 0.25, or use `f/(f+z)`. Negative-depth misses must still project at their actual negative depth. [M0 §5.3–5.4]

Draw newly created, minimal geometry: near/far court outlines, connecting edges, a few projected depth rectangles, translucent paddle rectangles, and a distinct ball. Use a system font and a new visual treatment; do not reproduce original drawings, logos, sprites, or animations. There is no audio in M1.

The canvas drawing uses the same 350 × 250 logical stage at native or enlarged CSS size, maintaining 7:5 aspect ratio. Default to a readable enlarged size that fits the window; provide a native-size view for comparison. Backing resolution follows device pixel ratio, but logical sizes, input mapping, and collision do not. Resizing redraws; it does not reset a trial or change field dimensions.

**Reference view:** render the latest completed snapshot, with interpolation off by default. This avoids adding a hidden one-tick visual delay to the initial feel assessment.

**Optional smooth view:** interpolate only presentation poses between completed snapshots with scheduler alpha. This is delayed interpolation, not prediction; label it explicitly. Do not interpolate across serve/reset/miss/return/wall discontinuities or between different ball generations; snap those poses instead. Neither interpolation nor its enable/disable control may write core state, installed boxes, or input caches.

An optional ball-depth rectangle may use the recovered scale with `max(z, 0)` and opacity `(100 - max(z, 0))/100`, clamped only for drawing. Its cadence is a declared presentation choice; it is not a reconstructed depth-marker callback. [M0 §5.4]

## 12. Enemy AI

The enemy has logical position and previous logical position at depth 75, with the same base dimensions and logical center-clamp limits as the player. Do not clamp using its reduced screen width. [M0 §10; E05–E06]

Read only the explicitly published ball sample. If published vz is positive, target its logical x/y and use selected divisor K. Otherwise target field center and use divisor 15.

`next = current - (current - target) / divisor`

Clamp in logical space, install projected display state, calculate logical displacement against the previous logical position, and publish it. Keep enemy logical displacement distinct from its smaller screen displacement. Enemy-created curve uses the former.

No prediction, wall interception solver, random error, hidden reaction timer, acceleration cap, or added difficulty multiplier is permitted. K = 1 follows the sampled target immediately, subject to legal logical clamp; it does not follow an unpublished future position.

### Recovered difficulty data

Store the complete table once and select by an integer level 1–10. Invalid levels are rejected. Selecting a different entry creates a new trial; parameters never change in the middle of an existing rally.

| Level | Depth speed | Curve divisor C | AI divisor K | First far-crossing update from z = 0 |
|---:|---:|---:|---:|---:|
| 1 | 2 | 25 | 17 | 38 |
| 2 | 2.33 | 22.5 | 14 | 33 |
| 3 | 2.66 | 20 | 11 | 29 |
| 4 | 3 | 17.5 | 9 | 26 |
| 5 | 3.33 | 15 | 7 | 23 |
| 6 | 3.66 | 12.5 | 5 | 21 |
| 7 | 4 | 10 | 3.5 | 19 |
| 8 | 4.33 | 10 | 2.75 | 18 |
| 9 | 4.66 | 10 | 2 | 17 |
| 10 | 6 | 10 | 1 | 13 |

These are M0's recovered table entries and analytically derived crossing counts, not measured timings. Mandatory representative cases are **1, 5, 10**; include **4** as an exact-plane-equality regression. There is no level-11 lookup or automatic campaign ending in M1. [M0 §11; E01–E02]

## 13. Match/serve/miss lifecycle

Use three gameplay phases: **ServeWaiting**, **Rally**, and **MissHold**. Host pause is orthogonal, not a fourth ball-physics mode.

| Transition | Exact M1 behavior |
|---|---|
| Initial load / Reset trial | Select validated difficulty; center both paddles and previous positions; zero movement; reset trial counters; create fresh centered stationary ball |
| ServeWaiting → Rally | Primary down with valid contact cache, zero vz, and installed-box overlap; use cached movement and serve floor |
| Rejected serve | Keep waiting; return a reason such as not-overlapping or cache-not-ready; no delayed auto-launch |
| Rally → Rally | Successful near/far return, with the recovered response and a return event |
| Rally → MissHold | Failed strict-plane test; zero motion/curve; retain overshoot; record one player or enemy miss |
| MissHold → ServeWaiting | Automatic same-trial retry at the start of tick `missTick + 19` |
| Retry rally control | Immediate retry at command dispatch, without an extra miss or score; current rally may be marked aborted |
| Difficulty selection | Hard Reset trial using the selected recovered tuple; not a mid-flight edit |

**Hold timing:** the miss is detected on tick m; automatic retry occurs at the start of tick m+19. This chooses 19 tick intervals, informed by M0's approximately 19-interval miss timeline, but does not claim verified animation/transition parity. Do not add the original root level-introduction delay. [M0 §4.4; U09 scope]

During MissHold, player and enemy continue their ordinary ticks; the ball handler is skipped. The enemy consumes the last published stopped sample and recenters with divisor 15. Ignore serve presses during this phase. That explicit phase guard is a deliberate M1 safety/scope decision concerning unresolved U07, not a recovered original `ballStop` click guard. [M0.5 §10, R13]

### Per-object reset matrix

| State | Same-trial automatic/manual retry | Hard trial reset / difficulty change |
|---|---|---|
| Player position and previous-position cache | Preserve both exactly | Center both |
| Player displacement, publication, installed display | Preserve; next ordinary player step replaces normally | Zero displacement; initialize centered publication/display |
| Enemy logical position and previous cache | Preserve both exactly | Center both |
| Enemy displacement, publication, installed display | Preserve; next ordinary enemy step replaces normally | Zero displacement; initialize centered publication/display |
| Ball logical position/motion/curve | Fresh ball at center, z = 0, all motion/curve zero | Same fresh-ball construction |
| Ball display | Install fresh centered box, with a new ball generation | Same |
| Ball contact cache | Invalidate; first ordinary ball handler populates it | Same |
| Published ball sample | Initialize centered/stopped for fresh-ball bootstrap | Same |
| Pointer target | Preserve last accepted target | Initialize center; subsequent mouse samples update normally |
| Rally return count | Reset | Reset |
| Trial miss/return counters | Preserve; retry itself adds no miss | Reset |
| Global simulation tick | Continue monotonically | Continue monotonically; advance trial identifier |

The paddle preservation, fresh-ball publication bootstrap, and cache invalidation are explicit U04/U05 compatibility choices. Preserve state existing **at retry**, including any normal paddle motion during MissHold, not the position at the earlier miss instant. Do not add an extra easing tick as part of reset.

Player/enemy generation labels stay stable across same-trial retries and change at a hard reset; the ball generation changes at each retry. These are model provenance identifiers, not a simulation of Flash allocation identities.

Toolbar controls must not bubble into serve handling. A reset invalidates the fresh ball cache, so a second press in the same input batch cannot silently serve the new ball. No automatic serving, finite-life game-over, or campaign step is added.

## 14. Treatment of U01–U05

All five remain **unverified at runtime** after M1. Unit tests establish compliance with the selected profile, not closure of the original research questions.

| Item | Exact provisional decision and rationale | Architectural location | Replacement and affected tests |
|---|---|---|---|
| **U01 — native field dimensions** | Use registration (25,25), width 301, height 201; derive R=326, B=226, center=(175.5,125.5). This follows M0's stroke-inclusive encoded-size interpretation, without treating native readback as measured. | `compat/profile.ts`; field construction in `core/state.ts` | Replace measured dimensions in a new profile after R01; derived geometry changes together. Update U01 geometry fixtures, dependent projection/contact fixtures, and labeled replays, not easing/curve laws. |
| **U02 — display quantization/edges** | Identity installation with binary64 stage coordinates; closed AABB overlap includes edge/corner touching; ball proxy remains installed until late projection. M0 supports box-based late collision; it does not establish native quantization or exact inclusion. Those two defaults are explicit engineering choices. | `compat/display.ts`; isolated overlap predicate in `core/collisions.ts`; installed state in core types | Replace installation/readback/bounds/overlap rules after R05/R08. Update U02 edge/readback fixtures and marginal replays. Keep old-box chronology and math tests unless evidence actually contradicts them. Player readback can feed future movement; ball logical coordinates stay separate. |
| **U03 — callback order** | Due lifecycle, commands, player, enemy, ball, completed publication. AI uses prior published ball; ordinary ball contact sees this tick's paddle publications. No evidence ranks this above alternative native schedules. | Named profile order and `core/tick.ts` orchestration | Replace phase order at the orchestration seam after R14; update publication-age, AI-lag, integrated contact and replay fixtures. Do not rewrite each actor's recurrence. |
| **U04 — mouse dispatch/cache age** | Serve dispatch precedes actor steps and uses the cache from the last completed ball handler, without fresh mouse-based velocity. Click changes local motion only. A fresh invalid cache rejects presses until first populated. This preserves M0's cached-state distinction while selecting an unverified boundary placement. | `runtime/input.ts` assignment; command dispatch in `core/tick.ts`; serve transition in `core/lifecycle.ts`; ball contact cache | Replace dispatch placement/bootstrap behavior after R02/R14; preserve ordered commands and explicit caches. Update before/after-boundary serve, moving-click, duplicate/invalid-cache and launch-publication tests. |
| **U05 — retry retention** | Preserve both paddles' positions, previous caches, displacement/publication and boxes; reconstruct ball and invalidate its contact cache. M0 finds no explicit universal recenter and suggests possible retention, but does not prove it. | Per-object operations in `core/lifecycle.ts`, construction in `core/state.ts`, retention description in profile | Replace only the measured per-object retention/reset rules after R11; update retry matrix, first-post-retry displacement, generation and replay fixtures. Hard reset remains a deliberate prototype operation. |

Do not implement five alternative production profiles merely to demonstrate replaceability. A small adapter-boundary test with a nonidentity test double is sufficient to prove that no renderer/pixel state controls physics and that changed player display readback can be committed without rewriting the ball equations.

U06 (post-level-10 behavior), U07 (stopped-miss click reachability), U08 (legacy score service), and U09 (exact audiovisual timing) remain outside M1. Their exclusions do not exempt strict physics ordering, cached input, or documented retry rules. [M0.5 §11]

## 15. Testing strategy

Separate three kinds of test claims in names/documentation: **M0 mathematical/control-flow contract**, **M1 provisional compatibility**, and **M1 host/integration policy**. Do not label any of them as native R01–R14 passes.

Use Node/Vitest without Canvas or a browser for the deterministic suite. Production core modules must be importable without initializing DOM handlers. Build fixtures from stated initial values and analytical rules, not by copying the implementation's output into expected snapshots.

For mathematical comparisons, use an explicit absolute tolerance of 1e-9 plus relative tolerance 1e-12 where appropriate; use exact booleans, event order, counters, phase transitions, and discrete tick indices. Keep strict gameplay boundaries exact. Local exact-edge tests test this profile's chosen predicate, not cross-runtime rounding parity.

### Required contract groups

| Group | Scenario and independent expected result |
|---|---|
| **T01 — constants/geometry** | Verify all ten tuples, base sizes, D=75, d=1.004, A=31.066017; derive U01 center/clamps; reject invalid difficulty indices. |
| **T02 — player** | Center → target (205.5,110.5) gives (195.5,115.5), delta (20,-10). Test error shrinking by 1/3, all clamps, and easing-before-clamp. An unchanged out-of-bounds target at a reached clamp gives zero further displacement. |
| **T03 — serve/curve** | Ready centered stationary serve gives vz=selected speed and c=(-0.01,-0.01). First active movement is left/down 0.01. Player delta (20,-10), C=25 gives c=(-0.8,-0.4); enemy gives (+0.8,+0.4). Test sign-dependent floor, exact 0.01 boundary, and no floor on ordinary stationary returns. |
| **T04 — free flight** | From (x,y,z)=(100,100,10), v=(1,-0.5,2), c=(0.2,-0.1), three collision-free ticks yield approximately x=104.196815923556, y=102.098407961778, z=16, vx=1.597612736305775, vy=-0.798806368152887, cx=0.197619072763722, cy=-0.098809536381861. Use M0's closed form as a separate oracle. |
| **T05 — walls** | From x=310.5, y=100, vx=1, cx=0.2, safe depth: right-wall response finishes x=311, vx=-1.2, cx≈0.166002656042497. Ordinary decay precedes wall attenuation. Test every wall, exact touching, overshoot discarded, and curve-sign retention. |
| **T06 — combined collisions** | Add y=40.5, vy=1, cy=0.2 to the right-wall fixture: top then right; y=40, vy=-1.2 and cy≈0.166002656042497. Add a plane crossing and accepted return: reflected lateral velocity survives, installed curve replaces the attenuated incoming curve. A miss instead zeros all motion. |
| **T07 — projection** | g(0)=1; g(75)≈0.2499999987104862, not forced 0.25. Test center invariance, off-center projection, z=15/37.5/75 and negative z, ball/paddle extents, and logical versus projected enemy clamp. |
| **T08 — AI** | From center to target (205.5,110.5), movement is (30/K,-15/K), with K=17,7,1; test legal clamp. From (205.5,110.5) with nonpositive published vz, recenter step is (-2,+1). Test stale published direction on serve and no random/predictive term. |
| **T09 — depth gates/returns** | Far crossings at 38/23/13 active ball updates for levels 1/5/10; symmetric near counts when starting at z=75 with negative speed. At level 4, exact z=75 or z=0 on update 25 does not contact; update 26 does. Returns preserve lateral motion and negate, not increase, vz. Test absence of a direction guard with explicitly synthetic states. |
| **T10 — collision proxies** | Closed-box edge/corner equality, just inside and just outside, both planes, and no radius-based point substitute. Execute the R08 analytical separating fixture below and its inverse: current box alone must not overrule a nonoverlapping old box. |
| **T11 — classifications** | Accepted hit accuracy at ±7/±5 is inclusive; just outside is not accurate. SUPER needs both components >0.10; (0.10,0.10) is CURVE; (0.05,0) is NONE. Hit location itself cannot add an angle or velocity impulse. |
| **T12 — ordering/input** | A moving-serve fixture gives the cache a delta different from the next paddle step: serve must use the former, return the latter. Test publication stamps, command ties, before/after-boundary clicks, duplicate/held button suppression, late-event reassignment, and no future sample applied to an earlier catch-up tick. |
| **T13 — lifecycle** | Both miss types are counted once; ball retains overshoot and installs display once. Hold lasts to m+19; paddles keep ticking. Retry preserves each matrix field and does not manufacture displacement. Fresh cache initially rejects serve. Hard reset/difficulty change resets only the specified fields. Miss-phase clicks cannot launch. |
| **T14 — scheduler/presentation/replay** | Same canonical log and initial state produce the same core result at synthetic 15/30/60/120/144 Hz render cadences and bounded jitter. Ten active seconds give 300 ticks when exact endpoint timestamps are supplied. Test overload suspension, focus pause, resume without stale clicks, Step, viewport/DPR mapping, render immutability, interpolation invariance, and export/replay round-trip. |

### R08-derived separating fixture

Use a stationary centered player with a populated cache. Ball pre-step logical state is `(centerX+42, centerY, 1)`, vx=20, vy=0, vz=-2, curves zero. Install its display from that pre-step state before advancing.

After movement, logical x is `centerX+62` and z=-1. The old box has horizontal center offset approximately 41.140 and combined half-width approximately 44.693, so it overlaps. A newly projected box has offset approximately 63.270 and combined half-width approximately 45.307, so it misses.

Under the selected profile, accept the return; finish z=0, vz=+2, vx=20, curve zero, and accuracy=false. This is an **analytically specified synthetic fixture inherited from M0.5**, not a native observation or a proof of natural human reachability. Pair it with an ordinary multi-rally scenario. [M0.5 §8]

### Closed-form and scenario safeguards

For free flight let q=1/1.004. M0 supplies `c(n)=c0×q^n`, `v(n)=v0+c0×(1-q^n)/(1-q)`, and the corresponding accumulated-position formula. Compare multiple finite n values, including n=0, and select inputs that actually stay away from walls/planes for a full-core comparison. Do not inadvertently compare a no-collision oracle with a colliding scenario.

Add a deterministic scripted multi-rally test covering a player return, enemy return, at least one wall event, both miss types across scenarios, and repeated retry. Fixtures may position an initial synthetic state through test construction; production UI must not acquire a cheat-state editor to support this.

Changing a compatibility profile may change integrated outcomes. Preserve analytical tests, version affected assumption fixtures, and explain each changed expectation. Never bulk-regenerate golden outputs to make a regression disappear.

## 16. Debug/trace facilities

A compact toggleable panel should show tick, lifecycle phase, trial/rally identifiers, difficulty and speed/C/K, player/enemy position and displacement, ball x/y/z and vx/vy/vz/cx/cy, last collision/miss, diagnostic counters, and profile ID. Display **“Provisional compatibility; native Flash parity unverified.”**

Display formatting may round for readability; exported numeric data must not. Include last published ball sample and source stamps for contact-cache samples, particularly the displacement consumed by a serve.

The core returns structured audit records; it does not print, call browser clocks, or write files. For ball updates, capture actual execution checkpoints sufficient to distinguish pre-integration, post-movement, post-decay, post-walls, pre-contact, post-response, and final display/publication. Do not later regenerate an expected checkpoint and label it observed.

For each contact record, include the actual old ball box, tested paddle box, pre-response logical ball state, result, cached paddle position/displacement and stamps, and new installed box. The debug observer may independently compute a counterfactual new-position box, clearly labeled **counterfactual**, without touching authoritative state. This makes R08 comparisons actionable.

### Minimal recording and replay

Keep a bounded ring of the last 600 tick records, with the full authoritative checkpoint immediately before the oldest retained tick. Export one local JSON capture containing schema version, profile ID, difficulty, checkpoint, canonical consumed tick commands, completed tick range, events/audit records, and expected final state. Include separate host timing/suspension metadata and version information for context; replay does not use wall-clock time as physics input.

A headless replay function consumes that checkpoint/log and calls the same core tick transition. It rejects unknown schema/profile versions, invalid indices, nonfinite numbers, and invalid command ordering. Test its round-trip. A browser file-import UI, trace viewer application, general save system, and command-line replay tool are deferred; local Export plus test-level replay is sufficient for M1.

The checkpoint must include held target, previous-position caches, installed boxes, contact cache and validity, published samples, lifecycle counters, and generation identifiers. Ball position alone is not a replay checkpoint. Exported captures from the new prototype are labeled M1 traces, never Flash/Ruffle traces.

Recording on/off, panel visibility, export, and visual interpolation must not change the authoritative result for a given command log. Return events have a stable order whether or not anyone is recording them.

## 17. Proposed file/module layout

These are candidate paths for the later implementation. This planning delivery does not create them in the repository.

```text
CurveballNext/
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  README.md
  .gitignore
  docs/
    original-behavior.md                   existing research; retain authority
    runtime-verification.md                existing limits; do not relabel as resolved
    project-boundaries.md                  existing permitted-material rules
    milestones/m1-faithful-offline-prototype.md
    compatibility-assumptions.md
    m1-acceptance.md
  src/
    main.ts                                composition and DOM bootstrap only
    styles.css
    core/
      types.ts                             state, commands, events, provenance types
      constants.ts                         effective M0 constants and difficulty table
      state.ts                             field/state construction and validation
      tick.ts                              ordered authoritative transition
      player.ts                            easing, clamp, displacement publication
      enemy.ts                             published-sample AI law
      ball.ts                              recurrence and late display/publication
      collisions.ts                        walls, AABB predicate, plane decisions
      projection.ts                        pure arctangent mapping
      lifecycle.ts                         serve, miss hold, retry, trial reset
    compat/
      profile.ts                           m1-provisional-01 decisions
      display.ts                           install/readback/proxy construction seam
    runtime/
      clock.ts                             fixed boundaries, pause/resume/step
      input.ts                             pointer adapter and ordered tick assignment
      viewport.ts                          CSS/stage/backing-store mapping
    presentation/
      canvas.ts                            immutable poses and drawing
      debug.ts                             controls, overlays and formatted panel
    debug/
      trace.ts                             bounded capture and JSON export data
      replay.ts                            headless checkpoint/command replay
  tests/
    contract/
      player-enemy.test.ts
      ball-curve.test.ts
      walls-planes.test.ts
      projection.test.ts
    compatibility/
      profile.test.ts
      ordering-serve.test.ts
      collision-proxy.test.ts
      retry.test.ts
    runtime/
      clock-input.test.ts
      viewport-render.test.ts
    scenarios/
      rally-replay.test.ts
    fixtures/
      m1-provisional-01.ts                  independently specified analytical cases
      replay-cases.json                     new implementation fixture data only
  reference-local/                          private, ignored, not served or bundled
    curveball.swf
```

Do not introduce a public asset directory, generated ActionScript, a runtime emulator, server folder, network abstraction, general dependency-injection system, or a scaffolding-only score/campaign subsystem. Closely related helpers may share these modules; do not turn every formula into a separate file.

Keep core/compat imports DOM-free. Pure projection/constants/types may be shared with presentation; presentation and host modules must never be imported back into the core. Configuration may live in `vite.config.ts`; a separate Vitest configuration is only needed if the chosen tooling actually requires it.

## 18. Build and development workflow

### Read-only preflight in the actual Windows checkout

The following commands are instructions for the implementing agent, not commands executed by this planning pass:

```powershell
Set-Location 'D:\Projetos\CurveballNext'
git branch --show-current
git rev-parse HEAD
git rev-parse '862cece^{commit}'
git status --porcelain=v1
git diff --cached --stat
git ls-files -- reference-local
git check-ignore -v -- reference-local/curveball.swf
Get-Content .\docs\project-boundaries.md
node --version
npm --version
```

Expected baseline: `main`; HEAD equals the full resolved baseline commit; no dirty tracked/untracked candidate changes; empty index; no tracked reference-local material; the ignore rule is active. Read README, M0, and M0.5 as well. Do not silently proceed when these expectations fail.

On the first implementation setup, select compatible stable tooling, install exact direct versions, and generate the lockfile. Subsequent reproducible installs use `npm ci`. The agent records actual Node/npm/dependency versions rather than asserting that this planning environment tested them.

Required package-script behavior:

| Script | Required operation |
|---|---|
| `npm run dev` | Local Vite development server, bound to loopback |
| `npm run typecheck` | Explicit TypeScript checking without emitting application output |
| `npm test` | One noninteractive Vitest run, with failed tests producing nonzero exit |
| `npm run test:watch` | Optional watch-mode convenience using the same tests |
| `npm run build` | Type-check, then build static assets to `dist/` |
| `npm run preview` | Local preview of the already built `dist/`, bound to loopback |

After the lockfile exists, normal validation is:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Inspect the production preview in the browser; do not substitute development-server success for build verification. Basic controls are primary mouse-down on the canvas to serve, Retry rally, Reset trial, difficulty selector, Pause/Resume, Debug, single Step while paused, interpolation toggle, and Export trace. Bind `R` to Retry and `Escape` to Pause only when appropriate; ignore keyboard auto-repeat and typing inside UI controls.

Extend `.gitignore` for `node_modules/`, `dist/`, test artifacts, and local capture outputs while preserving existing exclusions. Captures are local until explicitly selected as small new-implementation test fixtures. No SWF or original data blob enters `public`, `src`, tests, package files, or build output.

Finish with test/build results, browser evidence, `git diff --check`, `git diff --stat`, and a source/build material audit. Review untracked files as well as the diff. Leave changes uncommitted for the maintainer's review unless separately instructed otherwise. Do not publish, stage indiscriminately, or create a deployment.

## 19. Explicit non-goals

M1 contains no multiplayer, matchmaking, game WebSockets/WebRTC, application server, account/authentication, leaderboard or high-score backend, Steam integration, ranking, monetization, analytics, or public deployment infrastructure.

There is no original art, font, sound, animation, source-code conversion, SWF runtime loading, decompilation, or dependency on privately held reference bytes. All visual geometry is newly created.

Also excluded: mobile/touch/gamepad support, pointer lock, polished menus, campaign/lives/numeric scoring/time bonuses, automatic level advancement, level-11 behavior, save games, general replay UI, complex trace tooling, and complete audiovisual parity.

No swept collision solver, continuous time-of-impact integration, generic pinhole camera, Pong offset-angle response, random/predictive AI, speed normalization, rally-speed ramp, variable-delta physics, or new power-up/mechanic is permitted.

M2 may implement the recovered score/lives/progression rules and additional presentation only after a separately approved scope. It must not inherit an invented original campaign ending from M1. Native-runtime verification remains a separate evidence task; making a browser prototype does not retroactively complete M0.5.

## 20. Implementation sequence

Use six coherent steps. They are not separate architectural redesign exercises. The implementing agent should report a material contradiction when found rather than expanding scope to work around it.

| Step | Likely files/modules | Behavior introduced | Tests/evidence added | Acceptance condition |
|---|---|---|---|---|
| **1 — Verify baseline and establish tooling** | Existing docs, package/lock/config, `.gitignore`, core types/constants/state, profile | Minimal non-destructive project setup; exact constants; one named provisional profile; protected local reference | T01; import smoke test; type-check/test/build commands; reference-serving checks | Correct baseline/document gate; compatible pinned toolchain; empty app builds; no original material in runtime inputs |
| **2 — Implement the analytical kernel** | Player, enemy, ball recurrence, collisions, projection, display adapter | Recovered motion/curve/wall/projection/AI rules without browser coupling | T02–T08 and mathematical parts of T09/T11 | Numeric oracles pass; no delta-time/DOM dependency; no formula modernization |
| **3 — Connect ordering, collision proxies, and lifecycle** | Core tick/lifecycle/state, ball contact cache, installed boxes, profile order | Complete headless waiting/serve/rally/miss/retry loop; provenance; exact reset matrix; diagnostic events | T03/T09–T13, including both R08 separating directions and moving-click cache tests | Headless scenarios serve, return, miss once, retry, and preserve intended state under the named profile |
| **4 — Add host clock and ordered mouse input** | Clock, input, viewport, bootstrap | Fixed boundaries; timestamp assignment; no future-input catch-up; focus/overrun pause; coordinate mapping | Scheduler/input/mapping portion of T12/T14 across synthetic render cadences | Identical canonical inputs produce identical core states; pause/late-event policies are explicit and tested |
| **5 — Make the loop playable and observable** | Canvas/styles, DOM controls, debug panel, trace/replay | Independent new visuals; correct controls; native/enlarged view; optional interpolation; local capture export | Render immutability, checkpoint replay, initial production-browser smoke; T14 remainder | Human can serve/rally/retry at levels 1/5/10; debug shows real state; toggling presentation does not affect replay |
| **6 — Validate the integrated candidate and document** | Tests/fixtures, README, compatibility/acceptance documents; narrowly required fixes | No added feature scope; regression fixes only | Full deterministic suite, browser checklist, external-network-disabled preview, reference/build audit, diff review | All required gates pass with actual evidence; open U01–U05 remain accurately labeled; candidate ready for maintainer review |

Do not postpone headless tests until presentation is complete. Do not spend an early step on a generic extensible platform for later online play. If a defect reveals a missing implementation detail, solve it within the specified ownership/compatibility seams rather than redesigning the milestone.

## 21. Acceptance tests

### Automated gate

Every required T01–T14 group passes, including the integrated replay scenarios. Type checking and production build pass from the locked dependency installation. No mandatory test is skipped or downgraded to a snapshot that simply agrees with current code.

The fixed-clock test must compare core states and event sequences, not just count render callbacks. The old-box test must discriminate old versus new geometry, not use a centered hit where both would succeed. The input test must choose different old/new displacement values, not a stationary paddle that conceals cache timing.

### Required browser checks

| Check | Action | Pass criterion |
|---|---|---|
| **B01 — Boot/build** | Open production preview in a current desktop Chromium browser on the maintainer's machine | No console errors; visible field/ball/paddles; clear serve instructions; no reference-file dependency |
| **B02 — Serve and control** | Wait, move mouse, try nonoverlapping and overlapping presses, hold/release the button | Eased/clamped paddle; invalid press does not launch; valid down launches once; holding does not repeat |
| **B03 — Characteristic rally behavior** | Play at levels 1, 5, and 10, using horizontal, vertical, and diagonal paddle motion | Curves, depth, AI responses and wall deflections are visible; no invented offset-angle or rally-speed ramp; level parameters match the debug table |
| **B04 — Both misses and retry** | Cause a player miss; obtain an enemy-miss trace in normal or documented scripted testing; repeat retries | Correct side recorded once; ball visibly stops at overshoot; normal hold/retry resumes testing; no accidental universal paddle recenter |
| **B05 — Timing and view** | Toggle interpolation; change canvas size/browser zoom; inspect at available monitor refresh settings | Controls/geometry remain aligned; presentation mode is labeled; replay result unchanged; actual tick observations are consistent with fixed active-time scheduling |
| **B06 — Focus and pause** | Hide the tab or switch window, then return and use Resume; exercise single Step | No hidden-time burst, stale click, or resume-triggered serve; Step advances exactly one tick |
| **B07 — Offline/material boundary** | Block external network while preserving loopback access, reload production preview, inspect requests and output; attempt reference URL access on dev server | No external runtime dependency or original asset request; no original bytes in `dist/`; reference path does not return SWF content |
| **B08 — Capture and second-browser smoke** | Export a real play capture and replay it headlessly; smoke-test in a current Firefox desktop browser | Same-profile replay matches; Firefox can boot/control/serve/retry without functional errors; versions and limitations are recorded |

Browser refresh testing uses whatever hardware is available; synthetic 60/120/144 Hz tests remain mandatory even when the maintainer has only one refresh mode. Do not claim a manual refresh-rate measurement that was not performed.

Do not require a human to defeat level 10 to accept its parameters: require control, serve, observed AI/ball behavior, and the deterministic high-level fixtures. Enemy-miss behavior can be demonstrated by a documented deterministic scenario when ordinary play does not produce it readily. Such a scenario is not evidence of normal human reachability.

Automated browser tooling may be used if already available, but adding a broad Playwright/screenshot-testing stack is not part of M1. Record real manual browser checks. If a required browser check cannot be performed, label it pending and do not declare the milestone accepted.

The maintainer should record a short feel assessment: paddle response, visible curvature, readable depth, wall behavior, opponent responsiveness, and any discrepancies needing a future native trace. Do not tune recovered coefficients to improve that assessment. First distinguish a code defect, chosen compatibility assumption, host input behavior, or deliberately deferred presentation feature.

## 22. Risks and likely failure modes

| Risk | Typical symptom | Required mitigation |
|---|---|---|
| Wrong y convention or curve sign | Vertical shots bend/move the wrong way | Signed serve and player/enemy delta fixtures |
| Treating raw mouse speed as paddle movement | Excessive or refresh-dependent spin | Measured post-ease/post-clamp displacement; ordered input replay |
| Reading the wrong-age cache | Moving serves differ from the planned contract | Publication stamps and deliberately unequal cached/current deltas |
| Using current/interpolated collision geometry | R08 fixture fails; high-speed edge returns change | Explicit installed ball box with late replacement; no rendering authority |
| Flattening U02 into cosmetic rounding only | Later native readback correction requires rewriting player movement | Isolated committed near-paddle display readback, separate ball logical state |
| Replacing decimals/formulas with cleaner equivalents | Gradual numerical/projection divergence | M0 constant table, preserved arithmetic order, independent oracles |
| Projected rather than logical AI displacement | Enemy spin becomes depth-scaled incorrectly | Independent logical enemy position/displacement; screen proxy kept separate |
| Future mouse sample contaminates catch-up ticks | Different result at 60 versus 144 Hz | Timestamp-to-tick queues, causality fixtures, canonical replay |
| Pause/overload silently skips time or reuses clicks | Sudden misses/serves on returning to the tab | Explicit suspension, cleared live queue, dedicated Resume |
| Retry zeroes or corrupts preserved caches | Artificial first-tick spin after a miss | Per-object reset matrix and post-retry displacement tests |
| Interpolation adds unnoticed input/visual latency | Prototype feels softer despite correct equations | Interpolation off in reference view; label delayed smooth mode |
| Reference leaks through build or local tooling | SWF request succeeds or private bytes appear in output | No imports/public assets; deny rules; source/output/request audit |
| Scope expands into campaign/online architecture | Core rally validation is delayed | Hold score/lives/campaign/network work outside the milestone |
| New tests are misreported as Flash verification | False parity or closure claims | Separate test categories; keep M0.5 status and profile identity visible |

No known algorithmic obstacle prevents a provisional M1 implementation. Unavailable original-runtime instrumentation prevents a native-parity claim, not this explicitly bounded prototype.

## 23. Documentation updates required at completion

Update README with prerequisites, exact versions tested, install/test/build/preview commands, offline definition, mouse controls, focus/overload behavior, debug/export usage, the selected compatibility profile, and explicit limitations.

Keep the reviewed M1 plan under `docs/milestones/` when the implementation task authorizes documentation changes. Record any accepted scope adjustment instead of silently diverging from it.

Maintain `docs/compatibility-assumptions.md` with U01–U05 defaults, owning modules, fixture/test identifiers, future R01/R02/R05/R08/R11/R14 closure paths, and the explicit U06–U09 exclusions. Include the lifecycle reset matrix and the chosen command/actor order.

Create `docs/m1-acceptance.md` with actual full baseline/candidate identifiers where available, dependency versions, commands and outcomes, test counts, browser versions, manual observations, capture references, source/build audit, unresolved defects, and maintainer feel assessment. Distinguish automated M1 evidence from native-runtime evidence.

Do not rewrite M0's established rules to match the implementation. Do not change M0.5 INCONCLUSIVE results to PASS because analogous M1 tests pass. A short note linking to the provisional implementation may be added without altering the historical research findings.

Re-read project boundaries before completion. Record that code was independently written from behavioral rules and that visuals are newly drawn; support that with source/build review rather than relying solely on a file-extension scan. Reference-only research metadata and behavioral equations are not original executable or art assets.

## 24. Definition of Done

M1 is done only when the locked project builds, all mandatory deterministic tests pass, and the browser rally loop has been exercised with the required evidence. The player uses the recovered easing/displacement; the ball uses the recovered recurrence/curve/decay; walls and strict plane gates preserve their ordering; AI follows the recovered law; the installed old-box contact quirk remains intact under the provisional profile.

The scheduler has demonstrated fixed 30 Hz active-time behavior independently of render cadence, with tested input assignment and explicit suspension. Rendering, device pixel ratio, debug mode, and interpolation cannot change authoritative replay outcomes. Both misses, repeated retries, and trial resets behave according to the documented matrix.

The production prototype works without external network services or the original SWF, contains only independent code/presentation, and exposes enough state and trace provenance for later original-runtime comparison. U01–U05 are documented and isolated; no native-Flash parity or completed M0.5 gate is asserted.

All required browser checks and material audits are recorded, documentation matches the candidate, and no unresolved correctness defect prevents the stated scope from working. The agent leaves an honest handoff of changes and evidence for maintainer review; a commit is not part of this planning task or an automatic acceptance action.

### External technical source register

External sources inform tooling and browser integration only; they do not replace M0 gameplay evidence. Consulted 29 September 2026.

- **[W1] Vite — Getting Started.** Node compatibility, vanilla TypeScript setup, development/build tooling. `https://vite.dev/guide/`
- **[W2] Vitest — Getting Started.** Current combined Node/Vite requirements and noninteractive `vitest run`. `https://vitest.dev/guide/`
- **[W3] Vite — Deploying a Static Site.** Static build output and local-preview boundary. `https://vite.dev/guide/static-deploy.html`
- **[W4] Vite — Server Options, filesystem restrictions.** Deny rules, public-directory exception, alternative loader-path limitations. `https://vite.dev/config/server-options.html#server-fs-deny`
- **[W5] WHATWG HTML — Animation frames.** Animation-frame callback/timestamp mechanism. `https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames`
- **[W6] W3C — Pointer Events.** Coalesced samples, possible delivery aggregation, and avoiding duplicate parent/coalesced processing. `https://www.w3.org/TR/pointerevents/`

### M1 PLAN READY

**Acceptance summary:** a new offline desktop-browser rally prototype, with locked tooling, deterministic 30 Hz simulation, reconstructed ball/paddle/AI/projection behavior, explicit old-display collision state, bounded retry lifecycle, levels 1/5/10 validation, independent visuals, and replayable diagnostic evidence.

**Exact unresolved assumptions carried forward:** U01 uses 301 × 201 registration-derived geometry; U02 uses unquantized closed AABBs with late ball-box installation and an isolated display/readback seam; U03 uses lifecycle/commands → player → enemy → ball; U04 dispatches serve before movement using the prior ball cache, without immediate ball publication, and rejects uninitialized-cache presses; U05 preserves both paddles on same-trial retry while constructing a fresh ball, initializing its stopped publication, and invalidating its contact cache. None is promoted to a native-runtime measurement.

**Other declared M1 policies:** 19-tick miss hold; miss-phase serve guard; hard-reset difficulty changes; no score/lives/campaign; timestamp-assigned mouse input; explicit suspension above a five-tick catch-up budget; reference view without interpolation; loopback-served offline build.

**Ready for direct Codex handoff:** **YES**, after ordinary read-only checkout/document/toolchain preflight. The agent does not need to choose a gameplay architecture, invent compatibility defaults, or redesign milestone scope.

**BLOCKER:** No unresolved design blocker is identified for this provisional milestone. An unexpected/dirty baseline, missing or contradictory required project documents, or unavailable build prerequisites is a start gate to report and resolve before code changes. The M0.5 runtime-execution failure is **not** a blocker to M1 under this plan; it remains a blocker to asserting a runtime-verified native-parity contract.
