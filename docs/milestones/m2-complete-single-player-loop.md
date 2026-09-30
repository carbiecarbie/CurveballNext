# M2 — Complete original single-player loop

**Accepted and closed:** M2 was accepted at `103193cfc0b7642dc2d1d795fd34ddffce913abc` (`Implement M2 complete single-player loop`). That accepted baseline has 159 passing tests. The evidence below retains the earlier candidate's historical scope and validation counts.

**Status at time of evidence:** implementation candidate for maintainer review, uncommitted. **Baseline:** clean `main` at `d4a61a9049545110a235e6dacb6e73c8c7183d4a`, the authorized successor of accepted M1 `59cdbb9e3f232cf07a24c6c304ac43c851a64db4`.

## Implemented

The deterministic 30 Hz core now owns score, five persistent player lives, three enemy lives per level, the four independent depleting award buckets, and the level bonus. Accepted serves score accuracy and curve only; accepted player returns score accuracy, hit, then curve. Player misses immediately reset buckets. Eligible active-ball updates consume 25 bonus points per 11 updates, and the remaining amount is awarded once when enemy depletion resolves. The 19-tick miss hold and `m1-provisional-01` physics/input/retry rules remain in place.

Enemy depletion advances through the ten unchanged difficulty tuples, with player lives carried, enemy lives and buckets restored, and a 45-tick level presentation before the next serve. Zero player lives enters Game Over after the hold. New Game always restarts at level 1. The HUD displays score, level, lives and level bonus. A clearly labeled Debug / Testing section selects levels 1–10 and injects controlled misses for transition verification; normal campaign inputs do not use these fixtures.

**Level-10 containment policy:** after the third enemy miss at level 10 resolves, add the remaining level bonus once and enter `ContentComplete` while retaining level 10. Do not read an undefined level-11 tuple. This is a **CurveballNext compatibility containment policy**, not a verified original victory state. The original `Winner` label belongs to high-score qualification. Native R12 evidence may replace this policy.

Replay state includes all authoritative M2 values and lifecycle timestamps. Captures use `curveball-m2-trace-2`; M1 captures are rejected explicitly rather than reinterpreted. The core validates malformed checkpoint campaign fields before replaying commands.

## Validation

- Pre-edit M1 gates: 105 tests, typecheck and production build passed. `reference-local/` remained ignored.
- M2 gates: **143 tests in five files**, typecheck and production build passed. Tests cover exact awards, boundaries, depletion and reset scope, time-bonus eligibility, all ten tuples, middle and end transitions, dual-depletion priority, Game Over, level-10 containment, replay rejection/round-trip, and render-cadence independence.
- Installed Edge 154.0.4258.37, headless production preview on loopback: scripted New Game/HUD, invalid and accepted serve, both misses, Game Over/restart, level transition, direct levels 1/5/8/10, level-10 speed and containment, pause/step, synthetic blur/resume, view toggles, export and offline reload passed. A 362-record exported capture replayed exactly in the same Edge engine. No page/console errors or external gameplay requests. Controlled debug misses are test fixtures, not human high-level victories. Initial, Game Over and completion screenshots were visually inspected. Local evidence remains ignored under `captures-local/`.
- Production output is static HTML/CSS/JS; no original SWF, art, sound, font, reference material or historical service dependency is part of the runtime.

U01–U05 remain provisional native-Flash questions. Native R10 scoring persistence and R12 post-level-10 behavior remain unverified. This candidate does not claim native Flash parity or reconstruct the unavailable historical ranking service. No gameplay coefficients were retuned.
