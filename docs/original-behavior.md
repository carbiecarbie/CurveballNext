# Curveball — Original Behavior Specification

**M0 — Original Behavior Research**  
**Reference:** supplied `curveball(1).swf`  
**Research date:** 28 September 2026, America/Sao_Paulo  
**Status:** static behavior reconstruction completed; 52 bounded opcode consistency probes passed; original-player runtime verification pending.  
**Implementation status:** no replacement game implemented.

> This is a behavioral specification for a new, independent implementation. It contains equations, constants, state transitions, analytical metadata, and independently written pseudocode. It does not provide original ActionScript, converted JavaScript/TypeScript, original artwork, fonts, animation assets, or sound files.

## Evidence and confidence conventions

**CONFIRMED** means directly established from the supplied SWF's bytes, encoded geometry, action operands, or control flow. It does **not** mean that the entire game has been executed successfully in Flash.

**STRONG INFERENCE** means supported by the SWF and relevant display/runtime semantics, but not fully verified in a running original player. **HYPOTHESIS** means a proposed runtime consequence or unresolved compatibility choice requiring an experiment.

Hexadecimal offsets are absolute byte offsets in this specific uncompressed FWS file. Intervals are **start-inclusive, end-exclusive**. Timeline frame numbers are **one-based**. Appendix B maps evidence identifiers such as **E10** to precise locations. `evidence_index.json` supplies the complete 53-block action inventory.

The analysis used a read-only SWF parser, an AVM1 instruction decoder, stack-expression tracing, branch inspection, and a small bounded evaluator for selected original action blocks. Flash display properties, `hitTest`, audio, and timeline operations were mocked in that evaluator. Its 52 passing checks establish internal agreement between the decoded operations and this specification on the tested paths; they are **not 52 Flash/Ruffle runtime tests**. Original mouse dispatch, display rounding, bounding-box evaluation, and cross-clip scheduling were not exercised.

External Ruffle implementation sources were consulted only to cross-check SWF/AVM1 and MovieClip semantics. They are not sources for Curveball's gameplay constants and were not used to claim original-player verification. See Appendix D.

---

## 1. Executive summary

**CONFIRMED — core model.** Curveball uses three numeric position coordinates inside a rectangular logical volume, with a hand-written depth projection onto a 2D Flash display. There is no general 3D engine. The ball has separate lateral velocities, depth velocity, and two decaying curve components. Those curve components are **accelerations applied to lateral velocity once per frame**, not rotation or a purely visual effect. [E01, E09–E11]

The essential mechanisms recovered are:

| Mechanism | Recovered behavior | Confidence |
|---|---|---|
| Simulation clock | Nominal 30 updates per second; no delta-time in gameplay code | CONFIRMED |
| Player movement | Move two-thirds of the remaining distance to the mouse, then clamp | CONFIRMED |
| Player-created curve | `curveX = -paddleDeltaX / C`; `curveY = paddleDeltaY / C` | CONFIRMED |
| Enemy-created curve | Opposite signs to the player's formula | CONFIRMED |
| Curve integration | Add curve to lateral velocity before moving the ball | CONFIRMED |
| Free-flight curve decay | Divide each nonzero component by **1.004** per ball update | CONFIRMED |
| Wall response | Clamp, reverse the corresponding velocity, divide its curve component by approximately **1.2**, without reversing curve sign | CONFIRMED |
| Paddle response | Reverse depth velocity; replace curve; retain lateral velocity | CONFIRMED |
| Paddle collision | Object/object display-box `hitTest`, gated by strict logical depth crossing | CONFIRMED call form; runtime edge details pending |
| Collision timing | Ball display geometry is updated **after** its collision tests | CONFIRMED |
| AI | Ease toward current logical ball position while the ball approaches; otherwise ease toward center | CONFIRMED |
| Difficulty | Ten speed/curve/AI table entries | CONFIRMED |
| Lives | Five player lives per new game; three enemy lives per level | CONFIRMED |
| Ending | No authored final-level victory condition found; `Winner` is high-score qualification | CONFIRMED control flow |

Three particularly important corrections to a superficial reading are necessary. First, the global `curveDecay = 0.01` is **not** the divisor used by the ball; the ball's own load handler sets `curveDecay = 1.004`. Second, the initial global `curveAmount = 50` is overwritten before the first playable level; level 1 actually uses **25**. Third, `Winner` does not mean that all levels were beaten: the corresponding text says **“You Got a High Score!”** and is reached after a server response to game over. [E01, E02, E09, E18, E20]

**Feasibility conclusion.** The file contains enough information to recreate the core gameplay independently with high fidelity. The remaining work is not discovering an unknown physics model; it is validating a small set of Flash-specific scheduling, bounds, input, and lifecycle details. The historical ranking service cannot be fully reconstructed from this SWF because its server-side implementation is absent.

## 2. SWF metadata

| Field | Exact result | Evidence |
|---|---|---|
| Signature | `FWS` | E00 |
| Compression | None | E00 |
| SWF version | 5 | E00 |
| Header-declared size | 59,360 bytes | E00 |
| Actual size | 59,360 bytes | E00 |
| SHA-256 | `4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977` | E00 |
| Stage rectangle, twips | x: 0–7,000; y: 0–5,000 | E00 |
| Stage dimensions | 350 × 250 pixels | E00 |
| Nominal frame rate | 30 FPS | E00 |
| Main timeline frames | 115 | E00 |
| First tag offset | `0x000014` | E00 |
| Final End tag | `0x00E7DE` | E00 |
| End of file | `0x00E7E0` | E00 |
| Root-level tags | 339 | Full tag traversal |
| Tags including nested sprites | 1,282 | Full tag traversal |
| Sprite definitions | 9 | E22 and tag inventory |
| Action-bearing blocks | 53 | Appendix B inventory |
| Bytes occupied by those action blocks | 18,845 | Appendix B inventory |
| Scripting model | AVM1 / early ActionScript | Decoded action set |

All metadata above is **CONFIRMED**. The declared file length agrees with the available bytes. The tag stream and nested action blocks were parsed to their declared boundaries. No AS3 bytecode was found.

## 3. Internal structure

### 3.1 High-level organization

The root timeline handles menus, game initialization, level presentation, serve setup, and high-score requests. The actual moving-game logic is concentrated in four placed movie clips: player paddle, enemy paddle, a cosmetic depth marker, and the ball. The ball also owns the delayed post-miss decision on its own timeline. [E01–E12]

| Character / instance | Sprite frames | Placement / role |
|---|---:|---|
| Sprite 7, `bounds` | 1 | Root frame 1; measures the playfield |
| Sprite 59, `userPaddle` | 59 | Root frame 45, depth 43; player input, smoothing, hit indication |
| Sprite 62, `bonus` | 70 | Score-award notification animation |
| Sprite 66, enemy-life display | 30 | Life-count presentation |
| Sprite 68, player-life display | 30 | Life-count presentation |
| Sprite 75, `enemyPaddle` | 59 | Root frame 91, depth 13; AI and hit indication |
| Sprite 77, unnamed | 1 | Root frame 92, depth 11; projected depth rectangle |
| Sprite 80, unnamed | 20 | Root frame 92, depth 20; ball, physics, serve, miss lifecycle |
| Sprite 90 | 1 | High-score entry form container |

The important action-bearing placements are `0x00860F`, `0x00A588`, `0x00B078`, and `0x00B917`. They contain respectively two, two, two, and three clip-event handlers. There are also 40 timeline `DoAction` blocks and four button action blocks, giving 53 total. [E03–E12, E16–E19]

### 3.2 Tag inventory

| Tag type | Count, including nested sprites |
|---|---:|
| PlaceObject2 | 650 |
| ShowFrame | 386, of which 115 belong to the root |
| RemoveObject2 | 55 |
| DoAction | 40 |
| DefineEditText | 37 |
| FrameLabel | 34, of which 9 belong to the root |
| DefineShape | 17 |
| DefineText | 14 |
| SoundStreamHead2 | 10 |
| End | 10 |
| DefineSprite | 9 |
| DefineSound | 5 |
| ExportAssets | 5 |
| DefineButton2 | 4 |
| DefineShape2 | 2 |
| SetBackgroundColor | 1 |
| DefineFont2 / DefineFont / DefineFontInfo | 1 each |

The stream-sound headers have **no associated SoundStreamBlock tags** in this file. They must not be interpreted as ten additional embedded music tracks. The actual embedded event sounds are the five `DefineSound` entries. [E21; tag inventory]

### 3.3 Presentation-only timelines

Both paddle sprites have labels `N`, `UR`, `UL`, `BL`, `BR`, and `C`, starting at frames 1, 10, 20, 30, 40, and 50. Their local bounds remain **60 × 40** throughout all 59 frames. Hit animations therefore do not supply a larger collision region. [E14, E23]

Life displays have labels `L5`, `L4`, `L3`, `L2`, `L1`, `L0`, starting at frames 1, 6, 11, 16, 21, 26. The normal enemy count uses only the relevant lower-count labels. The bonus sprite rests on frame 1, starts its notification at label `bonus`, frame 10, and returns to its resting frame after frame 70.

## 4. Game state machine

### 4.1 Root labels

| Label | Frame | Behavior |
|---|---:|---|
| `Start` | 4 | Title/menu; stops at frame 5 |
| `HighScores` | 14 | Starts table request at 15; polls at 17; stops at 19 |
| `StartGame` | 36 | New-game presentation; initializes state at 44 |
| `Level` | 45 | Level presentation; installs difficulty and resets level bonuses at 90 |
| `Serve` | 91 | Enemy exists at 91; ball and marker enter at 92; root stops at 96 |
| `GameOver` | 97 | Ends gameplay display; requests qualification at 101, polls at 103 |
| `Winner` | 104 | High-score name entry, not campaign victory; stops at 108 |
| `Submit` | 109 | Waits for submitted-score response at 110 |
| `End` | 111 | Non-qualifying game-over ending/menu; stops at 115 |

These label/frame pairs are **CONFIRMED**. [E22]

### 4.2 Behavioral states and transitions

| Current state | Trigger | State change / next state |
|---|---|---|
| Title | Release start button | Root goes to `StartGame` |
| Title | Release high-scores button | Root goes to `HighScores` |
| New game | Root executes frame 44 | Create world; score 0; level 1; player lives 5; enemy lives 3 |
| Level presentation | Root executes frame 90 | Read difficulty at index `level - 1`; reset award buckets and time bonus |
| Serve waiting | MouseDown; depth velocity equals zero; ball display box overlaps player display box | Launch ball toward enemy, install player curve with minimum-curve rules, award eligible serve bonuses |
| Active rally | New logical depth exceeds 75 and enemy display-box test succeeds | Enemy return; rally continues |
| Active rally | New logical depth is below 0 and player display-box test succeeds | Player return; awards applied; rally continues |
| Active rally | Far-plane crossing and enemy test fails | Enemy loses one life; ball stops; miss animation plays |
| Active rally | Near-plane crossing and player test fails | Player loses one life; award buckets reset; ball stops; miss animation plays |
| Miss animation | Ball sprite reaches frame 20; enemy lives < 1 | Increment level; enemy lives = 3; add remaining level bonus; root goes to `Level` |
| Miss animation | At frame 20, enemy lives are not exhausted and player lives < 1 | Clear bonus labels; root goes to `GameOver` |
| Miss animation | At frame 20, neither condition above applies | Root goes to `Serve` |
| Game-over qualification | `loading == "no"` and `winner > 0` | Root goes to `Winner` name form |
| Game-over qualification | `loading == "no"` and `winner == 0` | Root goes to `End` |
| Score entry | Submit button release | Attempt submission unless placeholder name remains; go to `Submit` |
| Submission waiting | `loading == "no"` | Return to `HighScores` |
| High-score/menu screen | Main-menu button release | Root goes to `Start` |

The ball's miss-resolution action checks enemy depletion **before** player depletion. Ordinary play loses only one side's life per miss; an artificially injected state in which both are depleted would nevertheless take the level-advance branch first. [E12]

### 4.3 No final victory branch

**CONFIRMED:** the post-miss action unconditionally increments the level whenever enemy lives fall below one. It does not compare the level with ten, test a final-level flag, or route successful completion to `Winner`. An isolated action-block probe with level 10 and zero enemy lives produced level 11 and a jump to `Level`. This tests the branch only, not the playability or reachability of that situation in the original player. [E12]

**STRONG INFERENCE:** the next level setup then requests array index 10, beyond the ten supplied entries. No fallback difficulty or wraparound is authored. The exact downstream result depends on AVM1 undefined-value coercion and display/runtime behavior; it must not be described as a verified crash, normal level 11, or victory screen. [E02]

### 4.4 Timeline lifecycle and delays

The ball rests on its own frame 1. A miss issues `Play`; its frame 20 runs the retry/advance/game-over decision. This spans approximately **19 frame intervals, or 0.633 seconds at 30 FPS**, with exact externally perceived timing subject to event scheduling. The level presentation runs from root frame 45 to the setup at frame 90: **45 intervals, or 1.5 seconds**. [E02, E12]

**CONFIRMED:** the ball and marker are placed at frame 92, while retries jump back to 91. Their load handlers reinitialize position and motion when new instances are created. There is no explicit paddle-recentering operation in the post-miss action. **STRONG INFERENCE:** existing paddle state may survive a rewind that retains its timeline instance; whether placement on the destination frame is retained or recreated must be checked in the target runtime. Do not silently reset both paddles on every serve. [E03, E05, E12]

Stopping the root timeline at frame 96 is not a gameplay pause: the child EnterFrame handlers are the active gameplay mechanism. Cross-clip ordering and instance retention remain explicit runtime verification items.

## 5. Coordinate and perspective system

### 5.1 Logical volume

Let `L`, `R`, `T`, `B` be logical side boundaries and `D = 75` the far-plane depth. The root computes:

```text
L = bounds registration x
R = bounds registration x + bounds display width
T = bounds registration y
B = bounds registration y + bounds display height
Cx = L + (R - L) / 2
Cy = T + (B - T) / 2
```

The player plane is `z = 0`; the enemy plane is `z = 75`. Logical x increases to the right; logical y increases downward. Positive depth velocity travels toward the enemy. However, the ball's stored **positive lateral y velocity moves upward**, because its update subtracts that velocity from y. [E01, E09, E10]

### 5.2 The one-pixel playfield issue

The bounds instance is placed at **(25, 25)** with an identity linear transform. Its encoded local shape rectangle is:

```text
x = -0.5 ... 300.5
 y = -0.5 ... 200.5
```

Thus the encoded stroke-inclusive size is **301 × 201**, not 300 × 200. The root uses the registration point plus `_width`/`_height`; it does not use the actual leftmost/topmost drawn point. [E13]

Under stroke-inclusive display-property evaluation, this gives:

| Quantity | Value | Confidence |
|---|---:|---|
| Bounds registration | (25, 25) | CONFIRMED |
| Encoded local bounds size | 301 × 201 | CONFIRMED |
| Logical L, R | 25, 326 | STRONG INFERENCE for runtime `_width` |
| Logical T, B | 25, 226 | STRONG INFERENCE for runtime `_height` |
| Logical center | (175.5, 125.5) | STRONG INFERENCE |
| Player center clamp | x 55–296; y 45–206 | Derived from the above |
| Ball center wall limits | x 40–311; y 40–211 | Derived from the above |

The visible outline would instead extend globally from 24.5 to 325.5 and 24.5 to 225.5. A new implementation must not unknowingly substitute that outline's geometric minimum for the registration-based logical bounds. Runtime experiment R01 resolves the remaining display-property ambiguity.

### 5.3 Exact projection

Define the stored constant:

```text
A = 31.066017
pi = 3.141592653589793
```

For depth z, the code's scale is:

```text
g(z) = [90 - atan(z / A) × 180 / pi] / 90
```

Equivalently, in mathematical notation:

**g(z) = 1 − (2/π) arctan(z/A).**

Projection is:

```text
screenX = Cx + (logicalX - Cx) × g(z)
screenY = Cy + (logicalY - Cy) × g(z)
width   = baseWidth  × g(z)
height  = baseHeight × g(z)
```

For the ball, both dimensions use its single saved base width. The player remains at z = 0. The enemy stays at z = 75. [E05, E06, E09, E10]

| z | g(z), calculated from the encoded constant |
|---:|---:|
| 0 | 1.000000000 |
| 15 | 0.713630721 |
| 25 | 0.568611666 |
| 37.5 | 0.440436356 |
| 50 | 0.353928056 |
| 60 | 0.304151419 |
| 75 | 0.249999999 |

`A` is very close to `75 × tan(π/8)`, explaining the approximately one-quarter far-plane scale. That relationship is an inference about the constant's selection, not a reason to replace the stored decimal with a more precise derived value.

This is **not** the common pinhole formula `f / (f + z)`. Substituting that formula changes the perceived depth and the display boxes used by collision. The center `(Cx, Cy)` is the projection's vanishing point as depth tends to infinity.

### 5.4 Object dimensions and depth marker

The two paddles' encoded local bounds are x ±30, y ±20: **60 × 40** logical/display units at the near plane. The ball has x/y ±15: **diameter 30, radius 15**. At the far plane, nominal projected sizes are about 15 × 10 for the enemy and 7.5 × 7.5 for the ball. [E14, E15]

The depth marker is a projected rectangle whose depth follows the root's published ball depth. It clamps negative depth to zero, applies the same projection, and uses alpha `100 - depth`. It does not affect physics. A missed ball itself is not similarly depth-clamped; a near-plane miss may be projected at negative depth, making its scale exceed one. [E08–E10]

## 6. Player paddle

### 6.1 Input, smoothing, and clamping

Each player EnterFrame reads root mouse coordinates and performs, independently on each axis:

```text
newPosition = oldPosition - (oldPosition - mouseTarget) / 1.5
```

Equivalently, it moves **two-thirds of the error** toward the mouse. With a fixed target and no clamping, the remaining error becomes one-third of its previous value per player update. [E04]

Clamping occurs **after smoothing**, first y and then x:

```text
x ∈ [L + paddleWidth/2, R - paddleWidth/2]
y ∈ [T + paddleHeight/2, B - paddleHeight/2]
```

The clip's display position is then updated. Its published movement is measured afterward:

```text
paddleDeltaX = newClampedX - previousStoredX
paddleDeltaY = newClampedY - previousStoredY
previousStoredPosition = newClampedPosition
```

There is no division by elapsed time. The variables named paddle speed represent **logical displacement per player frame**. Curve generation uses this smoothed, clamped displacement, not raw mouse displacement. [E04, E10, E11]

Example, using the inferred center: from `(175.5, 125.5)`, a mouse target of `(205.5, 110.5)` produces `(195.5, 115.5)` and displacement `(20, -10)` on the next player update. This result passed a mocked numeric opcode probe.

### 6.2 Limits and previous-frame state

There is no separately configured maximum movement speed. Effective motion depends on error, the 1.5 smoothing divisor, and boundary clamping. Moving the mouse farther outside a boundary does not accumulate an out-of-bounds paddle position; subsequent displacement is measured from the clamped location.

The load handler initializes position and previous position at the center, and displacement at zero. It reads an otherwise uninitialized `world.lagFactor`, but that value is not used by the player update. It also assigns `m = 100` and `f = 0.8`; these are not applied as mass or friction. [E03, E04]

The load handler contains attempted assignments to `_root._xmouse` and `_root._ymouse`. These are native mouse-coordinate properties, not a demonstrated cursor-warp API. The safe conclusion is only that the assignments exist; actual pointer relocation was **not** established and should not be implemented from that observation alone.

### 6.3 Paddle impact location

Impact location affects hit-indication animation and the accuracy award. It does **not** directly select a new lateral rebound angle or add a hit-offset velocity. Two stationary-paddle contacts at different accepted locations preserve the same incoming lateral velocity and both install zero curve, except that their accuracy score and animation may differ. [E10]

Center classification uses x within ±7 and y within ±5 of the cached logical paddle center, inclusive. Outside that region, the relevant side/quadrant animation is chosen. For the central x strip but y outside the accuracy band, the x comparison with the paddle center chooses left/right indication; exact x equality takes the right-side branch. These animations have identical bounds throughout. [E10, E11, E14]

## 7. Ball simulation

### 7.1 Complete meaningful state

| State group | Contents / purpose |
|---|---|
| Logical position | x, y, z |
| Velocity | vx, vy, vz |
| Curve | cx, cy; per-update lateral accelerations |
| Cached world | L, R, T, B, D; Cx, Cy |
| Cached difficulty | launch speed, curve divisor C |
| Projection | A, base diameter, projected position and display dimensions |
| Contact input cache | Player/enemy logical centers and per-frame displacements |
| Lifecycle | `ballStop`, sprite playback/frame, parent world lives and score |
| Published output | Root ball position and velocity fields for AI and depth marker |

At ball load, position is `(Cx, Cy, 0)`, all three velocities are zero, and both curve components are zero. `ballStop` is not explicitly initialized; the handler's check is whether it equals one. Normal newly created state therefore enters the update rather than the stop branch. [E09, E10]

Unused loaded values include `m = 100`, `f = 0.8`, and `growshrink = 0`. They must not be turned into invented physics.

### 7.2 Exact order inside the ball EnterFrame handler

**CONFIRMED**, in this order: [E10]

1. If `ballStop == 1`, skip the entire handler.
2. Cache the currently published player and enemy positions and displacements.
3. Add cx to vx, then cy to vy.
4. Add vz to z.
5. Add vx to x.
6. Subtract vy from y.
7. Divide each nonzero curve component by 1.004.
8. Compute radius as saved ball width / 2.
9. Resolve top wall, otherwise bottom wall.
10. Resolve left wall, otherwise right wall.
11. If z > D, test enemy contact; otherwise, if z < 0, test player contact.
12. Project the resulting logical position and write the ball's display position and dimensions.
13. Publish ball position and velocity on the root.
14. Update the level-bonus countdown if eligible.

A miss sets `ballStop = 1` inside step 11, but does not abort the current handler. Steps 12–14 still run once. Because the miss also zeroes vz, that update does not consume a bonus-countdown tick.

### 7.3 Free-flight recurrence

For one update without collision:

```text
vx_next = vx + cx
vy_next = vy + cy
z_next  = z + vz
x_next  = x + vx_next
y_next  = y - vy_next
cx_next = cx / 1.004
cy_next = cy / 1.004
```

There is no gravity term, lateral friction, velocity normalization, acceleration of depth speed, or time delta. The game does not round these logical variables to integers in the decoded actions. Display setters may quantize separately; that remains a compatibility concern.

### 7.4 Launch and travel speed

The saved level speed is installed as positive vz on serve. Paddle returns negate vz. Neither wall collisions nor paddle contacts increase its magnitude. There is no rally-length speed escalation. The speed table covers values 2 through 6, but these are table extrema, not a separate clamping rule. [E02, E10, E11]

The magnitude of the full three-component velocity is not constant: lateral components can grow as curve is integrated. The game neither renormalizes them after curve changes nor resets them on a successful paddle hit.

### 7.5 Miss behavior

At a failed paddle test the ball sets vx, vy, vz, cx, cy to zero, starts its own miss animation, decrements the corresponding life counter, updates that life's display, plays the miss sound, and sets `ballStop = 1`. A player miss additionally restores the four award buckets. The out-of-plane z value is left at the overshoot position; it is not corrected to the plane on a miss. [E10]

## 8. Curve / spin mechanics

### 8.1 Curve generation

Let C be the current level's `curveAmount`. Let `(dpX, dpY)` be the cached player displacement and `(deX, deY)` the cached enemy displacement.

**On a player return:**

```text
cx = -dpX / C
cy = +dpY / C
```

**On an enemy return:**

```text
cx = +deX / C
cy = -deY / C
```

Both operations replace the old curve rather than adding to it. Lateral velocity is retained. [E10, assignments around `0x00C701–0x00C721` and `0x00CBE1–0x00CBF7`]

Because screen y motion subtracts vy, the player's acceleration is opposite the paddle's movement in **both screen axes**. The enemy's acceleration is in the same screen direction as its movement. This describes acceleration, not necessarily the ball's immediate direction: retained incoming velocity may initially carry the ball another way.

### 8.2 Decay and closed-form behavior

The ball-local divisor is **d = 1.004**, so the retained fraction is:

```text
q = 1 / 1.004 = 0.9960159362549801...
```

A component retains about 99.6016% of itself on each ordinary update. It is not multiplied by 0.99, reduced by a fixed 0.01, or decayed using the global variable bearing the same name. [E09, E10]

Absent contacts and walls, after n updates:

```text
c(n) = c(0) × q^n
v(n) = v(0) + c(0) × (1 - q^n) / (1 - q)
```

For x:

```text
x(n) = x(0) + n × vx(0)
       + cx(0)/(1-q) × [n - q × (1-q^n)/(1-q)]
```

For y, subtract the analogous vy/cy displacement rather than adding it. These formulas are independently derived from the confirmed recurrence, not copied source. They are useful as no-collision numerical oracles.

The no-wall curve half-life is approximately **173.633 updates**, or **5.788 seconds at 30 updates/second**. There is no explicit small-value cutoff during normal decay; the branch skips division only when the stored component equals zero.

### 8.3 Interaction with walls

After the ordinary per-update decay, a collision with the corresponding side wall divides that curve component again by:

```text
wallCurveDivisor = (d - 1) × 50 + 1
                 ≈ 1.2
```

The exact floating-point evaluation with d = 1.004 produces approximately `1.2000000000000002`; preserving the expression is preferable when pursuing numerical parity. The curve's **sign remains unchanged**. The corresponding lateral velocity changes sign. [E10]

Thus, following a right-wall bounce, leftward velocity may coexist with rightward acceleration, or the reverse depending on the preexisting curve. A curved trajectory can bend back toward the same wall. A corner contact applies both axis responses, y first, x second.

### 8.4 Minimum curve on serve only

The MouseDown launch handler first computes player curve with the standard formula, then independently adjusts each nearly zero component:

```text
If abs(cx) < 0.01:
    cx = +0.01 when cachedPlayerX < Cx
    cx = -0.01 otherwise

If abs(cy) < 0.01:
    cy = +0.01 when cachedPlayerY > Cy
    cy = -0.01 otherwise
```

Equality at magnitude 0.01 is not changed. These adjustments are **not applied on ordinary returns**. [E11]

For a stationary player exactly at the logical center, the fresh ball launches with `(vx, vy, vz) = (0, 0, levelSpeed)` and `(cx, cy) = (-0.01, -0.01)`. Its first subsequent ball update moves left and downward by 0.01 logical units each. This is the specified result for the centered cached state, not a claim that every human click has exactly centered or zero-displacement input.

### 8.5 Curve and super-curve thresholds

The scoring classifier simplifies to:

```text
SUPER when abs(cx) > 0.10 AND abs(cy) > 0.10
CURVE otherwise, when abs(cx) > 0.05 OR abs(cy) > 0.05
NONE otherwise
```

These are strict comparisons on the newly installed curve. Super curve requires both axes; a very strong purely horizontal shot is only normal curve for scoring. At exactly `(0.10, 0.10)`, the classification is normal curve, not super. At `(0.05, 0)`, it is none. [E10, E11]

For player displacement, normal curve requires at least one component's magnitude to exceed `0.05 × C`; super requires both to exceed `0.10 × C`. At level 1, those are 1.25 and 2.5 logical units per player update, respectively. At C = 10, they are 0.5 and 1.0.

### 8.6 Maximum curve and relationship to speed

There is no explicit maximum curve, angle, or lateral-speed clamp. The paddle's bounded travel and the displacement measurement impose geometric limits for valid states; those are not separately authored cap constants. Assuming the inferred 301 × 201 field and 60 × 40 paddles, the largest possible difference between two legal paddle positions is 241 horizontally and 161 vertically, so component magnitudes cannot exceed those differences divided by C. This is a conditional geometric bound, not proof that every extreme is reachable with an in-stage mouse sample.

Depth speed does not appear in the curve-generation formula. It changes the number of updates available for curve to act before the next contact. Increasing level speed and reducing C therefore have distinct, interacting effects; they cannot be collapsed into a single “difficulty multiplier.”

## 9. Collision system

### 9.1 Walls

Using the fixed logical radius r = 15:

| Wall | Strict detection condition | Position correction | Velocity | Curve |
|---|---|---|---|---|
| Top | `y - r < T` | `y = T + r` | `vy = -vy` | `cy /= wallCurveDivisor` |
| Bottom | `y + r > B` | `y = B - r` | `vy = -vy` | `cy /= wallCurveDivisor` |
| Left | `x - r < L` | `x = L + r` | `vx = -vx` | `cx /= wallCurveDivisor` |
| Right | `x + r > R` | `x = R - r` | `vx = -vx` | `cx /= wallCurveDivisor` |

Exactly touching a wall does not itself trigger the branch. Overshoot is discarded by clamping rather than reflected as a residual distance. Top/bottom are mutually exclusive for the update; left/right are mutually exclusive; one y response and one x response may both occur. There is no continuous time-of-impact solver and no repeated bounce loop for extreme velocities. [E10]

The velocity component's magnitude is preserved at the instant of reflection. Curve magnitude is reduced. The global `bounce = 1` is not referenced by these wall-response operations, so it should not be turned into a generalized restitution setting.

### 9.2 Paddle detection is display-box based

The far test is entered only when **z > 75**. The near test is entered only when **z < 0**, and only when the far branch was not selected. There is no radius/depth slab, no `vz` sign check, and no overlap test at exact plane equality. [E10]

The actual contact function is the one-object-argument form of MovieClip `hitTest`, with either the enemy or player clip as target. That is an object display-bounds test, not a ball-center test, circle/rectangle intersection, or a point/shape test. Ruffle's corresponding API and display-object implementation corroborate this interpretation; exact native edge inclusion and rounding remain to be measured. [E10, E11; Appendix D]

### 9.3 New depth, old ball display box

This is a material compatibility requirement. The handler first advances the logical ball, then checks walls and depth, then calls `hitTest`. Only after all those tests does it write the ball's `_x`, `_y`, `_width`, and `_height`.

Consequently, the depth gate sees **the new logical z**, whereas the collision function sees **the ball's previously installed display box**. An isolated probe recorded logical x = 177.5 and display x = 175.5 at the same contact call after a logical movement from the center. This verifies action ordering under mocked properties, not Flash's exact box rounding. [E10]

The paddle box is whichever display state has been installed when the ball handler executes. That depends on cross-clip event order. The contact's accuracy calculation separately uses the **new logical ball position** and cached logical paddle coordinates. Acceptance and accuracy therefore do not necessarily refer to identical times or coordinate spaces.

A replacement implementation that simply tests the new logical `(x,y)` against a paddle rectangle on the plane will not reproduce this quirk. Keep a dedicated collision-proxy box separate from interpolated rendering.

### 9.4 Nominal overlap widths are not the whole rule

At a perfectly synchronized near plane, a 30 × 30 ball box against a 60 × 40 paddle box gives nominal combined center-distance extents of 45 horizontally and 35 vertically. This is only an explanatory approximation. On actual crossing updates, the old ball box may have been projected from a different z, and the enemy is scaled at 75. Edge rounding and event ordering matter.

Both paddles retain the same encoded bounds throughout their hit animations; the ball's normal and miss drawings likewise have the same 30 × 30 local bounds. Thus the important variable is projected scale and installed transform, not an animation-dependent enlarged hit region. [E14, E15]

### 9.5 Successful contacts

**Enemy contact:** set z = 75; install `(deX/C, -deY/C)`; negate vz; preserve vx and vy; play the enemy hit sound. No player score is added. [E10]

**Player contact:** classify impact/accuracy; set z = 0; install `(-dpX/C, dpY/C)`; negate vz; award current hit score; classify and award eligible curve bonus; publish score; play the player hit sound. Preserve vx and vy. [E10]

The curve installed by a paddle contact has not yet undergone that frame's free-flight decay: the decay happened earlier to the incoming curve. The newly installed curve begins affecting velocity on the next ball update.

### 9.6 Multiple conditions in one update

A ball can hit a y wall, an x wall, and a paddle within the same update. Each wall reverses its lateral velocity and attenuates its incoming curve first. A successful paddle contact then overwrites both curve components, so that wall attenuation may have no lasting curve effect while the reflected lateral velocities remain. Multiple sound events may also be issued.

On a miss, velocity and curve are cleared after any earlier wall response, so the final state is stopped. With anomalous injected state, the strict depth branches still have no direction guard; do not infer one that is absent in the code.

## 10. Opponent AI

The enemy owns a logical `(x,y)` at constant depth 75. On every enemy EnterFrame it reads the root's published ball x, ball y, and depth velocity. [E05, E06]

```text
When published ball depth velocity > 0:
    target = current published logical ball position
    divisor = levelSkillFactor
Otherwise:
    target = field center
    divisor = 15

nextPosition = currentPosition - (currentPosition - target) / divisor
clamp to legal paddle-center boundaries
project at z = 75
movement = nextPosition - previousStoredPosition
publish logical position and movement
```

This is first-order following, not future-intersection prediction. It does not use the published lateral velocities, wall-bounce prediction, curve, a random error, or a deliberate reaction-delay timer. Its per-update speed is proportional to positional error; there is no separate speed-limit constant. [E06]

Smaller skill divisors are harder. At divisor 1, the paddle moves directly to the sampled ball position before legal-position clamping. At divisor 17, it closes one-seventeenth of the current error per update. A stationary target's unclamped error is multiplied by `1 - 1/K` per update.

The AI has access to exact logical ball position and direction, which are more precise than visual information available to a human. It does **not** thereby know the future. How fresh the published coordinates are at its update depends on the unresolved inter-clip schedule.

During an ordinary waiting serve or stopped miss, the last published depth velocity is zero; the recentering branch uses divisor 15. During a launch, the MouseDown handler changes the ball's local vz but does not immediately republish the root's ball-direction fields; that publication happens on the next ball EnterFrame. This can matter at event boundaries. [E06, E10, E11]

Enemy curve is an automatic consequence of its own last measured displacement, not a separate strategic spin-selection algorithm.

## 11. Level progression

The following arrays and their use at `level - 1` are **CONFIRMED**. The speed decimals are the stored values, not rounded display versions of fractions. [E01, E02]

| Level | Depth speed / update | Curve divisor C | AI divisor K | First far crossing, updates* | Seconds at 30 Hz* |
|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 25 | 17 | 38 | 1.2667 |
| 2 | 2.33 | 22.5 | 14 | 33 | 1.1000 |
| 3 | 2.66 | 20 | 11 | 29 | 0.9667 |
| 4 | 3 | 17.5 | 9 | 26 | 0.8667 |
| 5 | 3.33 | 15 | 7 | 23 | 0.7667 |
| 6 | 3.66 | 12.5 | 5 | 21 | 0.7000 |
| 7 | 4 | 10 | 3.5 | 19 | 0.6333 |
| 8 | 4.33 | 10 | 2.75 | 18 | 0.6000 |
| 9 | 4.66 | 10 | 2 | 17 | 0.5667 |
| 10 | 6 | 10 | 1 | 13 | 0.4333 |

\*Calculated depth-crossing counts from z = 0 with the listed constant positive speed and strict `z > 75`. These are not measured wall-clock recordings. They count ball updates after launch, excluding serve waiting, animation, and event-dispatch delay. For example, at speed 3 the ball reaches exactly z = 75 after 25 updates and checks the enemy only on update 26.

On level advance, enemy lives reset to three, the level number increments, and remaining time bonus is added to score. The following level-setup action resets award values, sets bonus display to 3000, and sets its counter to 10. **Player lives do not reset.** Paddle and ball sizes, playfield depth, decay divisor, and wall rules do not change by level. [E02, E12]

There are ten **defined difficulty entries**, not a verified ten-level campaign ending. See section 4.3 for the undefined next-entry issue.

## 12. Lives

A new game sets player lives to **5** and enemy lives to **3**. A failed corresponding paddle contact subtracts one. There is no separate tennis-style point score that must be accumulated before a life is lost. The visible life sprites follow the resulting count. [E01, E10]

The player life total carries between levels. Only enemy lives are explicitly restored on level completion. No extra-life award or remaining-life score multiplier appears in the decoded actions.

A player miss restores the four scoring buckets even when the remaining player life count becomes zero. The later miss-resolution action then routes to game over. An enemy miss leaves those buckets unchanged unless it ends the level, in which case level setup resets them. [E02, E10, E12]

## 13. Scoring

### 13.1 Award buckets

| Category | Initial/reset value | Decrement after its award | Floor |
|---|---:|---:|---:|
| Successful player return, `hitScore` | 100 | 10 | 0 |
| Normal curve, `curveBonus` | 50 | 5 | 0 |
| Super curve, `superCurveBonus` | 150 | 15 | 0 |
| Accuracy, `accuracyBonus` | 100 | 10 | 0 |

Each category is independent. Award the bucket's **current** value, then subtract its decrement and clamp the bucket at zero. Reaching zero does not disable a later qualifying event's animation; it merely makes that category worth zero. [E01, E02, E10, E11]

For a category with reset value a and decrement h, its nth qualifying award since reset is:

```text
award(n) = max(a - (n - 1) × h, 0)
```

### 13.2 Accuracy

Accuracy requires an accepted player contact and:

```text
abs(newLogicalBallX - cachedPlayerX) <= 7
abs(newLogicalBallY - cachedPlayerY) <= 5
```

The boundaries are inclusive. These comparisons use logical positions, not scaled screen coordinates or the exact box-overlap point. Both a successful return and an accepted serve can qualify. [E10, E11]

### 13.3 Return versus serve

For a successful player return:

```text
score gain = eligible accuracy bucket + current hit bucket
             + either normal-curve bucket, super-curve bucket, or zero
```

For an accepted serve:

```text
score gain = eligible accuracy bucket
             + either normal-curve bucket, super-curve bucket, or zero
```

**There is no hitScore award on serve.** A stationary centered fresh serve consequently awards 100 accuracy points and leaves the hit bucket at 100. It consumes the first accuracy award, reducing that bucket to 90. This behavior passed an isolated opcode probe. [E11]

On a return, accuracy is processed first, then the ordinary hit, then the curve award. When both accuracy and curve qualify, both scores are added, but the later curve message can replace the accuracy message in the shared notification clip.

Enemy returns award no points. An enemy miss awards no immediate direct “kill” points; the third miss can lead to the level-completion bonus after the miss animation. There is no separate rally multiplier or remaining-life multiplier in the inspected actions. [E10, E12]

### 13.4 Reset scope

The buckets reset on new game, new level, and **player miss**. They do not reset merely because the enemy missed and another serve begins at the same level. Therefore “per rally” is not an accurate description of the depletion scope.

### 13.5 Level time bonus

At level setup:

```text
remainingBonus = 3000
counter = 10
```

At the end of each eligible ball update:

```text
If depthVelocity != 0 AND remainingBonus > 0:
    counter -= 1

If counter < 0:
    counter = 10
    remainingBonus -= 25
    update displayed bonus
```

The strict negative counter test means **11 eligible updates per 25-point decrement**, not ten. Eligibility is determined after contact/miss response. A miss zeroes depth velocity before this check, so its detection update is not eligible. Waiting-to-serve and ballStop updates do not consume bonus. Partial counter progress survives a same-level retry. [E10, tail `0x00D42C–0x00D51C`]

For ordinary reachable bonus state and N eligible updates since level setup:

```text
remainingBonus(N) = max(3000 - 25 × floor(N / 11), 0)
```

It reaches zero after **1320 eligible updates**, equivalent to **44 seconds of counted rally time at 30 Hz**. This is not 44 seconds since the level screen appeared. The remaining amount becomes actual score only when enemy lives are exhausted and the ball's miss-resolution action runs. [E12]

### 13.6 High-score handling

The SWF requests relative `highscore.php`, and displays ten rows with name, score, and level fields. Game over requests:

```text
checkscore.php?Score=<score>&Level=<level>
```

It polls `loading` and uses a returned `winner` value to choose the qualification form or normal ending. Ranking comparison rules, tie breaking, persistence, and server validation are absent from this file. [E17, E18]

The name field has a maximum length of **15** and initial placeholder `enter here`. The submit action constructs `enterscore.php` parameters for score, level, name, and an `alg` field. That last field is string concatenation of level, name, score, and the fixed suffix `a83l9xj`; it is not a cryptographic computation. The submit action goes to the waiting state even when the placeholder prevents the request. [E19]

No timeout, robust error path, or explicit URL-encoding step appears in these request actions. Returned values outside the expected `winner > 0` / `winner == 0` cases are not given a normal explicit branch. These observations describe client control flow, not the current availability or behavior of any historical server. No score submission or other request to that backend was performed.

## 14. Timing and frame dependence

### 14.1 What is tied to frames

Ball motion, curve acceleration, curve decay, paddle smoothing, AI following, paddle-displacement measurement, the bonus countdown, and animation-based transitions all depend on update counts. The nominal reference rate is 30 FPS. No gameplay `getTimer`, delta-time calculation, or random-number operation was found in the decoded action inventory. [E00, E04, E06, E10, E12]

Running the same actions at a different tick frequency changes real-time speed, the effective smoothing bandwidth, input-displacement samples, and time bonuses. Merely multiplying positions by elapsed time is insufficient because the whole discrete recurrence and collision ordering contribute to behavior.

### 14.2 Determinism scope

With identical initial state, input samples, event ordering, numeric semantics, and collision-property behavior, the inspected numeric logic has no discovered randomness source. This supports a deterministic implementation. It does not establish bit-identical behavior between native Flash, every Ruffle version, and a new engine.

The exact order of the player, enemy, marker, and ball EnterFrame callbacks is not encoded as one explicit master loop in this game. Display depth alone must not be assumed to determine that order. Creation order, runtime scheduling, and action-queue semantics need verification. In particular, the ball may consume displacement published by a preceding or previous-frame paddle callback.

MouseDown is also separate from EnterFrame. The ball's MouseDown handler uses cached paddle variables populated during its most recent EnterFrame rather than fetching the current root-published values again. A modern event loop that samples input and immediately recomputes paddle velocity at click time would make a different shot in some cases. [E10, E11]

### 14.3 Fixed-timestep recommendation

Use an authoritative **30 Hz** simulation and an independent render cadence. Keep all behavioral constants in original per-tick units initially. Define one documented order for input dispatch, player movement, enemy movement, ball update, display-proxy publication, and timeline transitions after observing the reference scheduler.

Interpolate visuals for higher refresh rates without moving the collision proxy at render frequency. Mouse position may be sampled once per simulation tick, while button transitions require an explicitly timestamped/order-preserving queue. Do not apply the latest raw mouse displacement directly as spin.

On frame stalls or a hidden browser tab, choose an explicit pause/catch-up policy for the modern product. That policy is a new integration decision, not something fully specified by this SWF. A deterministic input log should identify simulation-tick numbers and within-tick event order.

## 15. Sound-event mapping

The following is analytical metadata only. No sound payloads were extracted or supplied for reuse. All five events are encoded as MP3 sound definitions, with the SWF fields specifying 11,025 Hz, mono, and a 16-bit sound-size flag. Sample counts are header values, not measured audible durations. [E21]

| Sound ID | Exported linkage | DefineSound tag | Sample count | Trigger |
|---:|---|---|---:|---|
| 1 | `wallBounce2` | `0x000019` | 5,487 | Top or bottom wall |
| 2 | `wallBounce1` | `0x0005EE` | 4,688 | Left or right wall |
| 3 | `pPaddleBounce` | `0x000B5B` | 6,732 | Accepted player return or serve |
| 4 | `missSound` | `0x001202` | 4,674 | Either side misses |
| 5 | `ePaddleBounce` | `0x00176D` | 3,472 | Accepted enemy return |

The initialization action creates and attaches the named Sound objects. Event calls use start offset zero and one play. The code also calls a `globalSound` object's `setVolume(80)`; the call is confirmed, but its exact audible scope was not runtime-tested. [E01]

Y-wall sound is issued before x-wall sound in a corner case. A paddle or miss sound can follow those within the same ball handler. No additional embedded sound trigger dedicated to level completion or final victory was found.

## 16. Exact constants and lookup tables

Appendix A is the master constants table and `constants.json` is its machine-readable counterpart. Distinguish **effective** constants from startup values and unused scaffolding:

| Name / location | Value | Effective role |
|---|---:|---|
| `world.speed`, startup | 2 | Overwritten with level-table speed at frame 90 |
| `world.skillFactor`, startup | 17 | Overwritten with level-table AI divisor |
| `world.curveAmount`, startup | 50 | Overwritten before gameplay; level 1 uses 25 |
| `world.curveDecay`, startup | 0.01 | Not the value read by the ball's decay operations |
| Ball-local `curveDecay` | 1.004 | Actual free-flight divisor and wall-divisor input |
| `world.bounce` | 1 | No use in the decoded wall response |
| `lagFactor` | Read from uninitialized world member | Not used by player movement |
| `m`, `f` | 100, 0.8 | Assigned in object load handlers, not used as physics terms |
| `growshrink` | 0 | Assigned, not used for the depth projection |

There is no evidence for a hidden mass-based impulse, restitution equation using `bounce`, random AI skill adjustment, or real-time multiplier behind these unused values. A clean implementation should omit dead scaffolding rather than inventing a purpose for it.

## 17. Behavioral pseudocode

The following pseudocode is an independent statement of observed rules, **not converted ActionScript**. It deliberately does not prescribe unverified cross-clip scheduling. `displayBox` represents the state last installed by a clip update, not an interpolated drawing.

### 17.1 Player and enemy steps

```text
PLAYER_STEP(mousePosition):
    next = player.position + (mousePosition - player.position) × (2/3)
    next = clampPaddleCenter(next)
    installPlayerDisplayPosition(next)
    player.displacement = next - player.previousPosition
    player.previousPosition = next
    player.position = next
    publishPlayer(position, displacement)

ENEMY_STEP():
    if publishedBall.depthVelocity > 0:
        target = publishedBall.logicalXY
        divisor = currentLevel.aiDivisor
    else:
        target = field.center
        divisor = 15
    next = enemy.position + (target - enemy.position) / divisor
    next = clampPaddleCenter(next)
    installEnemyDisplay(project(next, depth=75))
    enemy.displacement = next - enemy.previousPosition
    enemy.previousPosition = next
    enemy.position = next
    publishEnemy(position, displacement)
```

### 17.2 Ball step

```text
BALL_STEP():
    if ball.stopFlag == 1:
        return

    contactCache = copyCurrentlyPublishedPaddleStates()

    ball.vx += ball.cx
    ball.vy += ball.cy
    ball.z  += ball.vz
    ball.x  += ball.vx
    ball.y  -= ball.vy

    if ball.cx != 0: ball.cx /= 1.004
    if ball.cy != 0: ball.cy /= 1.004

    radius = ball.baseDiameter / 2
    attenuation = (1.004 - 1) × 50 + 1

    if ball.y - radius < field.top:
        ball.y = field.top + radius
        ball.cy /= attenuation
        ball.vy = -ball.vy
        emit(Y_WALL_SOUND)
    else if ball.y + radius > field.bottom:
        ball.y = field.bottom - radius
        ball.cy /= attenuation
        ball.vy = -ball.vy
        emit(Y_WALL_SOUND)

    if ball.x - radius < field.left:
        ball.x = field.left + radius
        ball.cx /= attenuation
        ball.vx = -ball.vx
        emit(X_WALL_SOUND)
    else if ball.x + radius > field.right:
        ball.x = field.right - radius
        ball.cx /= attenuation
        ball.vx = -ball.vx
        emit(X_WALL_SOUND)

    if ball.z > 75:
        if overlap(ball.previousInstalledDisplayBox, enemy.installedDisplayBox):
            showEnemyImpactIndicator(ball.logicalXY, contactCache.enemy.position)
            ball.z = 75
            ball.cx = contactCache.enemy.dx / currentLevel.curveDivisor
            ball.cy = -contactCache.enemy.dy / currentLevel.curveDivisor
            ball.vz = -ball.vz
            emit(ENEMY_HIT_SOUND)
        else:
            STOP_FOR_MISS(ENEMY)
    else if ball.z < 0:
        if overlap(ball.previousInstalledDisplayBox, player.installedDisplayBox):
            classifyPlayerImpactAndAwardAccuracy(contactCache)
            ball.z = 0
            ball.cx = -contactCache.player.dx / currentLevel.curveDivisor
            ball.cy = contactCache.player.dy / currentLevel.curveDivisor
            ball.vz = -ball.vz
            awardAndDeplete(HIT)
            awardEligibleCurveCategory(ball.cx, ball.cy)
            publishScore()
            emit(PLAYER_HIT_SOUND)
        else:
            STOP_FOR_MISS(PLAYER)

    installBallDisplay(project(ball.position), ball.baseDiameter)
    publishBallPositionAndVelocity()

    if ball.vz != 0 and remainingBonus > 0:
        bonusCounter -= 1
    if bonusCounter < 0:
        bonusCounter = 10
        remainingBonus -= 25
        publishRemainingBonus()
```

### 17.3 Serve, awards, and miss resolution

```text
MOUSE_DOWN():
    if ball.vz != 0:
        return
    if not overlap(ball.installedDisplayBox, player.installedDisplayBox):
        return

    # Use the ball's existing cache; do not refresh it here.
    classifyPlayerImpactAndAwardAccuracy(contactCache)
    ball.vz = currentLevel.depthSpeed
    ball.cx = -contactCache.player.dx / currentLevel.curveDivisor
    ball.cy = contactCache.player.dy / currentLevel.curveDivisor

    if abs(ball.cx) < 0.01:
        ball.cx = +0.01 if contactCache.player.x < field.centerX else -0.01
    if abs(ball.cy) < 0.01:
        ball.cy = +0.01 if contactCache.player.y > field.centerY else -0.01

    awardEligibleCurveCategory(ball.cx, ball.cy)
    publishScore()
    emit(PLAYER_HIT_SOUND)
    # No ordinary HIT award, no ballStop check, no immediate root ball publication.

AWARD_ELIGIBLE_CURVE_CATEGORY(cx, cy):
    if abs(cx) > 0.10 and abs(cy) > 0.10:
        awardAndDeplete(SUPER_CURVE)
        showSuperCurveNotification()
    else if abs(cx) > 0.05 or abs(cy) > 0.05:
        awardAndDeplete(CURVE)
        showCurveNotification()

AWARD_AND_DEPLETE(category):
    score += category.remainingValue
    category.remainingValue = max(category.remainingValue - category.decrement, 0)

STOP_FOR_MISS(side):
    set all ball velocity and curve components to zero
    start ball's miss-animation timeline
    decrement side's lives and update its life display
    if side == PLAYER:
        reset all four award buckets
    set ball.stopFlag = 1
    emit(MISS_SOUND)

ON_MISS_ANIMATION_FRAME_20():
    if enemyLives < 1:
        level += 1
        enemyLives = 3
        score += remainingBonus
        publish score and level
        go to LEVEL_PRESENTATION
    else if playerLives < 1:
        clear bonus labels
        go to GAME_OVER_QUALIFICATION
    else:
        go to SERVE_SETUP
```

The simplified miss helper preserves gameplay-state effects; the bytecode's precise placement of sound/display calls differs slightly between the two miss branches. The ball update, curve installation, counter ordering, and the priority of post-miss conditions above are the behaviorally material sequences recovered.

## 18. Remaining uncertainties

| ID | Uncertainty | What is already established | Why it remains open |
|---|---|---|---|
| U01 | Exact runtime field width/height | Encoded bounds are 301 × 201; registration is (25,25); formulas use native properties | Native `_width`/`_height` must be sampled |
| U02 | Display quantization and edge inclusion | Object/object box test; old ball display state used | No native display engine was run |
| U03 | Inter-clip EnterFrame order | Each handler's internal order and publish/read locations are known | Runtime callback/action-queue schedule not measured |
| U04 | MouseDown versus mouse/paddle updates | Serve uses last cached values, without refreshing | Actual event ordering and first-click timing need capture |
| U05 | Paddle retention across timeline rewinds | No explicit retry recenter; placement frames are known | Native timeline instance-lifetime details need observation |
| U06 | Behavior after clearing defined level 10 | Miss resolution increments to 11; lookup arrays end at index 9 | Reachability and undefined-value consequences not run |
| U07 | Click during stopped miss animation | MouseDown lacks ballStop guard and accepts vz == 0 | Real overlap/event reachability and scoring consequences unverified |
| U08 | Legacy high-score policy | Client fields, requests, and winner branching known | Server code and data are absent |
| U09 | Exact presentation/audio timing | Frame counts and sound call locations known | No rendered or audible original session captured |

For U07, an injected stopped-but-overlapping state accepted MouseDown, changed vz, and awarded accuracy in a bounded probe, while leaving `ballStop = 1`. That proves the guard omission's local consequence, **not** that a human can reliably reproduce or exploit it during normal gameplay. The following EnterFrame remains stopped unless the timeline replaces the ball.

No gap above justifies substituting a different physics model. Conversely, the existence of exact constants does not justify claiming native-player-perfect parity before these checks.

## 19. Runtime verification plan

### 19.1 Execution status and test setup

**All experiments below are pending against a running original SWF.** No native Flash or Ruffle rendering session was executed in this research environment. The separate `opcode_probe_results.json` records 52 completed bounded numeric/control-flow probes, with their mocked API limitations; it is not a substitute for the following plan.

Use an offline, instrumentable player and the exact hashed SWF. Record the player/emulator version, viewport scale, effective frame rate, and whether the movie is loaded at the root or inside a wrapper. Disable or isolate the historical score endpoints; no external submission is needed. Prefer timestamped scripted input and per-tick variable logging to video-only inference.

Log at minimum: tick number; callback identity and sequence; raw mouse coordinates; player/enemy logical positions and displacement; ball position, velocity, curve, stop flag; display positions/dimensions immediately before each hitTest; hitTest result; score buckets; bonus counter; lives; and timeline transitions. Keep instrumentation outside any future independent implementation.

### 19.2 Controlled experiments

| ID | Input / preparation | Measure | Expected from static analysis | Uncertainty resolved |
|---|---|---|---|---|
| R01 | Start a new game at unscaled 350 × 250 stage; inspect bounds and center | Native `_width`, `_height`, world L/R/T/B, center | Likely 301 × 201 and center (175.5,125.5); exact formulas in section 5 | U01 |
| R02 | Hold paddle at the true center until displacement is zero; click once | Cached input, initial curve, score, first ball displacement | cx = cy = -0.01; vz = level speed; accuracy +100; no hit award; first movement left/down 0.01 | U04 plus launch validation |
| R03 | Before contact, impose controlled slow horizontal movement; repeat with faster movement | Published displacement, installed cx, vx before/after | cx = -dpX/C; lateral velocity retained; curve proportional to measured paddle motion | U03/U04, curve generation |
| R04 | Repeat with vertical and diagonal motion across threshold boundaries | Both curves and score-category choice | Player screen acceleration opposes motion; super only if both magnitudes exceed 0.1 | Sign and classifier validation |
| R05 | Produce accepted stationary-paddle contacts at center, ±7/±5, and just beyond those bands | Accuracy award and post-hit lateral velocity | Inclusive accuracy boundaries; no hit-offset velocity impulse | U02 plus accuracy/contact distinction |
| R06 | Produce a curved shot that reaches one wall, then a corner | Curve and velocity immediately around the update; sound order | Pre-motion acceleration; ordinary /1.004 decay; wall /~1.2; velocity reversal only; y then x | Wall recurrence and ordering |
| R07 | Compare far-plane crossings at levels 1, 4, and 10 | Tick count since launch, z at test, old display box | 38, 26, 13 ball updates respectively; strict plane crossing | U02/U03 and depth timing |
| R08 | At an identical logical crossing state, compare old-display overlap with current-logical overlap | Box test inputs/result and accuracy inputs | Contact uses old installed ball display, not newly projected logical state | U02; highest-priority collision compatibility |
| R09 | Freeze/log AI update input at several levels; reverse ball depth direction | AI displacement and sampled ball age | Error/K while approaching; error/15 toward center otherwise; no randomness/prediction | U03 and AI behavior |
| R10 | Wait on serve, play counted updates, miss, and retry | Bonus counter, remaining bonus, all award buckets | No waiting decay; -25 each 11 eligible updates; player miss resets buckets; enemy miss does not | Countdown/reset validation |
| R11 | Move paddles away from center before a same-level retry, then a level advance | Instance identities, Load events, retained positions/previous positions | Ball reset is expected; paddle retention must follow observed timeline semantics | U05 |
| R12 | Instrument a level-10 completion without contacting external services | Next label, level lookup values, subsequent motion | Advance branch selects 11; no authored victory branch | U06; instrumented path separate from natural reachability |
| R13 | During a miss animation, move player display toward frozen ball and click | MouseDown delivery, box overlap, score, vz, stop flag | If overlap succeeds, handler has no stop guard; actual reachability is unknown | U07 |
| R14 | Record callback sequence and clicks immediately before/after a tick | Precise enter-frame, mouse, cache, and projection sequence | Internal handlers follow this report; global order to be measured | U03/U04 |

A practical minimum fidelity gate is R01, R02, R05, R06, R08, and R14 before freezing the replacement simulation contract. R10 and R11 should precede score/progression acceptance. R12 can be treated as an explicit compatibility-policy decision once the original consequence is known.

## 20. Recommendations for a clean modern implementation

### 20.1 Preserve behavior, not the Flash architecture

Use this report, the master constants, the evidence index, and eventually runtime observations as the handoff. A separate implementer need not receive the original ActionScript or original assets. Design new visuals, sounds, typography, interface, and code. The analytical similarity of equations does not require recreating the original sprite/timeline organization.

A useful independent separation is: deterministic simulation state; input sampling and ordered event dispatch; projection and collision proxies; AI behavior; score/progression state; and an entirely original presentation layer. These are proposed engineering boundaries, not additional mechanics found in the SWF.

### 20.2 Fidelity choices to keep explicit

Preserve 30 Hz behavioral updates, paddle easing before displacement measurement, acceleration-before-motion, late display projection, strict depth checks, unchanged lateral velocity at paddle contact, wall curve sign preservation, and separate depleted score buckets. Do not silently add variable-time physics, swept collisions, speed growth, random AI, angle-based paddle response, or a conventional pinhole camera.

Some original quirks may be undesirable in a modern product. A final-level ending, safer click-state guards, a new ranking backend, and a different presentation cadence are legitimate new design decisions, but they should be clearly identified as deviations. Establish a reference-faithful mode or baseline first rather than accidentally changing the rules during implementation.

### 20.3 Immediate next milestone

The next research step is a narrow runtime-verification pass covering the high-priority compatibility questions, not another broad search for the physics equations. After that, specify a small independent offline single-player prototype with original assets and deterministic trace tests. Browser hosting and any multiplayer architecture should be planned separately; this SWF contains a single-player AI game plus score-service calls, not a networked match protocol.

### 20.4 Final assessment

**Yes: this SWF contains enough information to reproduce the gameplay with high fidelity in a completely independent modern implementation.** The ball recurrence, curve equations, paddle smoothing, collision branch ordering, AI law, difficulty tables, lives, scoring, and state transitions are recoverable and documented. Native display/input/timeline details still need the bounded runtime checks listed above, and the absent historical server prevents a complete reconstruction of its ranking policy. This report should therefore be treated as a strong behavioral foundation, not a claim that native-player parity has already been demonstrated.

---

## Appendix A — Master constants table

The table below is generated from the reviewed constants inventory. “Derived” entries retain the confidence of any runtime-dependent input rather than being promoted to direct bytecode facts.

| Name | Value | Purpose | Confidence | Evidence |
|---|---|---|---|---|
| `swfSignature` | `FWS` | Uncompressed file signature | CONFIRMED | E00 |
| `swfVersion` | `5` | SWF format version | CONFIRMED | E00 |
| `fileBytes` | `59360` | Actual and declared length | CONFIRMED | E00 |
| `stageWidth` | `350` | Root stage pixels | CONFIRMED | E00 |
| `stageHeight` | `250` | Root stage pixels | CONFIRMED | E00 |
| `nominalFPS` | `30` | Reference tick/animation rate | CONFIRMED | E00 |
| `rootTimelineFrames` | `115` | Main timeline length | CONFIRMED | E00 |
| `worldDepth` | `75` | Enemy-plane logical depth | CONFIRMED | E01, E05 |
| `nearPlane` | `0` | Player-plane logical depth | CONFIRMED | E09, E10 |
| `boundsRegistration` | `[25, 25]` | Root placement of bounds object | CONFIRMED | E13 |
| `boundsLocalRect` | `[-0.5, 300.5, -0.5, 200.5]` | Encoded local xMin/xMax/yMin/yMax | CONFIRMED | E13 |
| `boundsEncodedSize` | `[301, 201]` | Encoded rectangle width and height | CONFIRMED | E13 |
| `logicalBoundsExpected` | `[25, 326, 25, 226]` | L/R/T/B assuming stroke-inclusive native width and height | STRONG INFERENCE | E01, E13 |
| `logicalCenterExpected` | `[175.5, 125.5]` | Center derived under the native-width assumption | STRONG INFERENCE | E01, E13 |
| `paddleBaseWidth` | `60` | Both paddles, encoded local width at scale one | CONFIRMED | E14 |
| `paddleBaseHeight` | `40` | Both paddles, encoded local height at scale one | CONFIRMED | E14 |
| `ballBaseDiameter` | `30` | Normal and miss encoded ball width/height | CONFIRMED | E15, E09 |
| `ballWallRadius` | `15` | Saved base width divided by two | CONFIRMED | E15, E10 |
| `playerCenterClampExpected` | `[55, 296, 45, 206]` | xMin/xMax/yMin/yMax from expected field dimensions | STRONG INFERENCE | E04, E13 |
| `ballCenterWallLimitsExpected` | `[40, 311, 40, 211]` | xMin/xMax/yMin/yMax from expected field dimensions | STRONG INFERENCE | E10, E13 |
| `projectionA` | `31.066017` | Arctangent depth-scale constant | CONFIRMED | E05, E09 |
| `projectionPi` | `3.141592653589793` | Encoded pi in projection arithmetic | CONFIRMED | E05, E09, E10 |
| `projectionQuarterTurn` | `90` | Degree scale divisor and subtraction baseline | CONFIRMED | E05, E09, E10 |
| `projectionHalfTurn` | `180` | Radian-to-degree numerator | CONFIRMED | E05, E09, E10 |
| `playerEaseDivisor` | `1.5` | Move error/divisor before clamp | CONFIRMED | E04 |
| `enemyReturnToCenterDivisor` | `15` | Enemy easing when published vz is not positive | CONFIRMED | E06 |
| `ballCurveDecayDivisor` | `1.004` | Effective free-flight curve divisor | CONFIRMED | E09, E10 |
| `curveRetainedFraction` | `0.9960159362549801` | Derived per-update multiplicative retention | CONFIRMED | E09, E10 |
| `wallCurveFactor` | `50` | Multiplier in (curveDecay-1)*50+1 | CONFIRMED | E10 |
| `wallCurveDivisorExpression` | `(1.004 - 1) * 50 + 1` | About 1.2; preserve arithmetic order for parity | CONFIRMED | E10 |
| `serveMinimumCurveMagnitude` | `0.01` | Per-axis floor rule only when magnitude is strictly below threshold | CONFIRMED | E11 |
| `normalCurveThreshold` | `0.05` | At least one axis strictly above, unless super applies | CONFIRMED | E10, E11 |
| `superCurveThreshold` | `0.1` | Both axes strictly above | CONFIRMED | E10, E11 |
| `accuracyHalfWidth` | `7` | Inclusive logical x accuracy band | CONFIRMED | E10, E11 |
| `accuracyHalfHeight` | `5` | Inclusive logical y accuracy band | CONFIRMED | E10, E11 |
| `levelSpeed` | `[2, 2.33, 2.66, 3, 3.33, 3.66, 4, 4.33, 4.66, 6]` | Depth velocity magnitude by level; index level-1 | CONFIRMED | E01 @ 0x007673, E02 |
| `levelCurve` | `[25, 22.5, 20, 17.5, 15, 12.5, 10, 10, 10, 10]` | Curve displacement divisor by level | CONFIRMED | E01 @ 0x0076BF, E02 |
| `levelSkillFactor` | `[17, 14, 11, 9, 7, 5, 3.5, 2.75, 2, 1]` | AI follow divisor by level | CONFIRMED | E01 @ 0x00761B, E02 |
| `definedDifficultyEntries` | `10` | Not a final-victory condition | CONFIRMED | E01, E12 |
| `initialLevel` | `1` | New-game level | CONFIRMED | E01 |
| `initialPlayerLives` | `5` | Reset only by new-game initialization | CONFIRMED | E01 |
| `enemyLivesPerLevel` | `3` | New game and each completed-level reset | CONFIRMED | E01, E12 |
| `initialScore` | `0` | New game only | CONFIRMED | E01 |
| `hitScoreReset` | `100` | Ordinary player-return bucket; no serve hit award | CONFIRMED | E01, E02, E10 |
| `curveBonusReset` | `50` | Normal-curve bucket | CONFIRMED | E01, E02, E10 |
| `superCurveBonusReset` | `150` | Super-curve bucket | CONFIRMED | E01, E02, E10 |
| `accuracyBonusReset` | `100` | Accuracy bucket; serve can consume it | CONFIRMED | E01, E02, E10, E11 |
| `hitDegrade` | `10` | Hit bucket decrement after award | CONFIRMED | E01, E10 |
| `curveDegrade` | `5` | Curve bucket decrement after award | CONFIRMED | E01, E10, E11 |
| `superCurveDegrade` | `15` | Super bucket decrement after award | CONFIRMED | E01, E10, E11 |
| `accuracyDegrade` | `10` | Accuracy bucket decrement after award | CONFIRMED | E01, E10, E11 |
| `awardBucketFloor` | `0` | Bucket lower clamp | CONFIRMED | E10, E11 |
| `levelBonusInitial` | `3000` | Potential level-completion score | CONFIRMED | E01, E02 |
| `levelBonusCounterReset` | `10` | Decremented until strictly negative | CONFIRMED | E01, E02, E10 |
| `levelBonusCounterPeriod` | `11` | Derived eligible updates per decrement | CONFIRMED | E10 @ 0x00D42C-0x00D51C |
| `levelBonusDecrement` | `25` | Points removed each counter cycle | CONFIRMED | E10 |
| `levelBonusExhaustionTicks` | `1320` | Derived eligible ticks to reach zero | CONFIRMED | E01, E02, E10 |
| `ballStoppedFlagValue` | `1` | Skips ball EnterFrame; absent from MouseDown guard | CONFIRMED | E10, E11 |
| `ballMissResolutionFrame` | `20` | Delayed life/level decision in ball sprite | CONFIRMED | E12 |
| `paddleAnimationLabelFrames` | `{"N": 1, "UR": 10, "UL": 20, "BL": 30, "BR": 40, "C": 50}` | Visual impact states, unchanged bounds | CONFIRMED | E23 |
| `lifeDisplayLabelFrames` | `{"L5": 1, "L4": 6, "L3": 11, "L2": 16, "L1": 21, "L0": 26}` | Life-count presentation | CONFIRMED | Sprite 66 and 68 label tags |
| `bonusNotificationStartFrame` | `10` | Label bonus in sprite 62 | CONFIRMED | Sprite 62 label tags |
| `bonusNotificationLastFrame` | `70` | Returns to resting frame 1 | CONFIRMED | Sprite 62 frame 70 DoAction |
| `depthMarkerAlphaBaseline` | `100` | Alpha = 100 - max(published depth, 0) | CONFIRMED | E08 |
| `soundVolumeCall` | `80` | setVolume argument; audible scope not tested | CONFIRMED | E01 |
| `soundStartOffset` | `0` | Sound.start first argument | CONFIRMED | E10, E11 |
| `soundPlays` | `1` | Sound.start second argument | CONFIRMED | E10, E11 |
| `highScoreDisplayRows` | `10` | Name/score/level rows in ranking display | CONFIRMED | E17 |
| `highScoreNameMaxLength` | `15` | Name input text field maximum length | CONFIRMED | E19, text ID 83 |
| `highScoreNamePlaceholder` | `enter here` | Submission request skipped while placeholder remains | CONFIRMED | E19 |
| `submissionSuffix` | `a83l9xj` | Literal string concatenation suffix, not encryption | CONFIRMED | E19 |
| `startupWorldSpeed` | `2` | Startup value overwritten by level lookup | CONFIRMED | E01, E02 |
| `startupWorldSkillFactor` | `17` | Startup value overwritten by level lookup | CONFIRMED | E01, E02 |
| `startupWorldCurveAmount` | `50` | Startup value; first playable level replaces it with 25 | CONFIRMED | E01, E02 |
| `unusedWorldCurveDecay` | `0.01` | Global startup member, not ball-local divisor | CONFIRMED | E01, E09 |
| `unusedWorldBounce` | `1` | Not applied to collision response | CONFIRMED | E01, E10 |
| `unusedMassLikeValue` | `100` | m assignment without simulation use | CONFIRMED | E03, E05, E09 |
| `unusedFrictionLikeValue` | `0.8` | f assignment without simulation use | CONFIRMED | E03, E05, E09 |
| `unusedGrowShrink` | `0` | Assigned, not projection driver | CONFIRMED | E05, E09 |


## Appendix B — Reproducible evidence map

| ID | Absolute location(s) | Evidence contents |
|---|---|---|
| E00 | Header `0x000000–0x000014`; whole file for hash | Signature, version, size, stage, rate, frame count |
| E01 | Root frame 44 actions `0x0071F0–0x0077C0` | World initialization, score/lives, all three difficulty arrays, sound linkage |
| E02 | Root frame 90 actions `0x008D21–0x008F15` | Per-level lookup, award and time-bonus resets |
| E03 | Player Load `0x008636–0x00890E` | Center, old position, base dimensions, unused scaffolding |
| E04 | Player EnterFrame `0x008914–0x008C79` | Mouse target, smoothing, clamp, displacement, publication |
| E05 | Enemy Load `0x00A5B0–0x00AA57` | AI divisor, initial state, depth, projection |
| E06 | Enemy EnterFrame `0x00AA5D–0x00B02F` | Current-ball following, center return, clamp, movement publication |
| E07 | Marker Load `0x00B093–0x00B41E` | Base rectangle and projection state |
| E08 | Marker EnterFrame `0x00B424–0x00B698` | Published ball depth, negative-depth clamp, alpha, projection |
| E09 | Ball Load `0x00B933–0x00BCF2` | Zero motion, effective decay 1.004, width, projection constant |
| E10 | Ball EnterFrame `0x00BCF8–0x00D51C` | All physics, contact, miss, return-score, publish, and bonus-clock operations |
| E11 | Ball MouseDown `0x00D522–0x00DEF0` | Serve gate, cached input, minimum curve, serve awards |
| E12 | Sprite 80 frame 20 actions `0x00B787–0x00B913` | Retry, level increment, completion bonus, game over |
| E13 | Shape 6 tag `0x001C12`; sprite 7 tag `0x001DE5`; root placement `0x001E01` | Encoded field bounds and registration transform |
| E14 | Sprite 59 definition `0x0079DB`; sprite 75 definition `0x009954` and nested shapes | Paddle local bounds throughout all animation frames |
| E15 | Sprite 80 definition `0x00B734`, shape IDs 78 and 79 | Ball local bounds in normal and miss states |
| E16 | Button actions `0x00646A–0x00648B`, `0x0064FA–0x00651C`, `0x00675E–0x00677B` | Start, high scores, and main menu |
| E17 | Root actions `0x00657B–0x0065AE`, `0x0070AF–0x007108`; associated text fields | High-score table request, poll loop, ten display rows |
| E18 | Root actions `0x00DF77–0x00DFF5`, `0x00DFFF–0x00E095` | Score qualification request and Winner/End branching |
| E19 | Submit button `0x00E1FC–0x00E32D`; poll `0x00E773–0x00E7B2`; text field 83 | Name length, submission fields, placeholder gate, wait loop |
| E20 | Static text ID 89 tag `0x00E697` | “You Got a High Score!” qualification text |
| E21 | DefineSound tags `0x000019`, `0x0005EE`, `0x000B5B`, `0x001202`, `0x00176D`; ExportAssets tags | Five embedded sound definitions and linkage names |
| E22 | Root FrameLabel tags; see `evidence_index.json` | All nine root state labels and exact frames |
| E23 | Sprite 59 and 75 FrameLabel/DoAction tags | Neutral, quadrant, center animations and stop/return actions |

Selected ball-handler landmarks, useful when independently checking control flow:

| Operation | Landmark |
|---|---|
| Cache paddle states | `0x00BFC7–0x00C05A` assignment endpoints |
| Add curve to velocities | `0x00C07C`, `0x00C09E` |
| Move z, x, y | `0x00C0C0`, `0x00C0E2`, `0x00C104` |
| Divide free-flight curve | `0x00C140`, `0x00C17C` |
| Wall branches | `0x00C18E–0x00C461` |
| Enemy depth gate / hit test | `0x00C475`; call at `0x00C490` |
| Enemy new curve / depth reversal | `0x00C701`, `0x00C721`, `0x00C740` |
| Player depth gate / hit test | `0x00C87A`; call at `0x00C895` |
| Player accuracy award | `0x00CA6D` and following depletion |
| Player new curve / depth reversal | `0x00CBE1`, `0x00CBF7`, `0x00CC16` |
| Ordinary hit award | `0x00CC4A` and following depletion |
| Return curve classification | `0x00CCBF–0x00D0AE` |
| Player-miss resets | `0x00D1C8–0x00D20D` assignment endpoints |
| Late ball projection / display writes | `0x00D23F–0x00D3AE` |
| Publish ball state | `0x00D3C2–0x00D42B` assignment endpoints |
| Bonus counter, including short-circuit guard | `0x00D42C–0x00D51C` |
| Serve hit-test call | `0x00D67E` |
| Serve initial vz and curve | `0x00D9A4–0x00D9DA` assignment endpoints |
| Serve minimum-curve branches | `0x00DA06–0x00DABF` |

The three hit-test landmarks distinguish the CallFunction byte from its immediately following conditional branch. No original action listing is included in the handoff package.

## Appendix C — Completed bounded opcode probes

**52 / 52 passed.** The machine-readable results include each injected input category, observed values under the mocked evaluator, expected values, and evidence offsets. Covered paths include all ten level lookups; stationary serve and first motion; curve thresholds; accuracy edges; corner response and sound-call ordering; strict depth crossings; enemy return; old display state at hitTest; both miss branches; bonus guard and depletion to zero; level-10 increment; game over; player smoothing and clamping; AI following/recentering; and the missing stopped-serve guard in an injected state.

The probe evaluator follows decoded opcode branches rather than executing an independently reimplemented game loop. Nevertheless, its MovieClip, sound, and timeline APIs are mocks. In particular, choosing a mocked hitTest result does not demonstrate real box overlap; the field width/height fixture does not settle native `_width`; and a mocked goto does not determine native instance retention. These limitations are repeated in `opcode_probe_results.json`.

## Appendix D — External technical references

These primary implementation sources were consulted as semantic cross-checks. Paths refer to Ruffle's public repository as retrieved during the research; they are not a pinned runtime build used for experiments. All Curveball-specific facts in the report are instead tied to the supplied SWF and its hash.

| Reference | Limited use |
|---|---|
| Ruffle `swf/src/avm1/opcode.rs` and `swf/src/avm1/read.rs` | AVM1 opcode names, operand layouts, relative branch offsets, and pushed-number decoding |
| Ruffle `swf/src/read.rs` and `swf/src/types.rs` | SWF tags, bit fields, placement records, and AVM1 clip-event flags |
| Ruffle `core/src/avm1/globals/movie_clip.rs`, function `hit_test` | Distinguishes one-object hitTest from point/shape forms |
| Ruffle `core/src/display_object.rs`, `hit_test_object`, `width`, `height` | Bounds-based object overlap and display-property interpretation |
| Ruffle `core/src/display_object/movie_clip.rs`, `run_frame_avm1` and `run_goto` | Confirms that callback/timeline lifetime behavior deserves separate runtime validation |

Source locations, provided as code-formatted references:

```text
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/swf/src/avm1/opcode.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/swf/src/avm1/read.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/swf/src/read.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/swf/src/types.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/core/src/avm1/globals/movie_clip.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/core/src/display_object.rs
https://raw.githubusercontent.com/ruffle-rs/ruffle/master/core/src/display_object/movie_clip.rs
```
