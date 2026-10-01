# Project Boundaries

This project is an independent implementation inspired by the gameplay concepts of the 2002 Flash game Curveball.

The original SWF and related extracted material are reference-only. Do not copy or redistribute original ActionScript, graphics, sounds, fonts, animations, or other original assets.

Write the implementation independently from the behavioral specification in `docs/original-behavior.md`. The original SWF may be used only for behavioral verification and runtime comparison.

M0 static reconstruction is complete. M0.5 remains a historical blocked runtime-verification report. M4 is completed and accepted after independent review against pinned Ruffle v0.6.0 at `cac5c99ce4a17e606f4ee3090389bb878f852055`. Simulation Contract v1 remains provisional; **historical Adobe Flash Player equivalence is unproven**.

U01 field geometry, U02 display quantization/old-box contact, U03 callback order, U04 MouseDown/cache timing and U05 actor retention/readiness are resolved only within the verified/tested pinned-runtime scope. CurveballNext matches that scope except documented intentional containment and explicitly retained uncertainties. R12 deliberately ends at level 10; the injected original level-11/undefined-difficulty path does not establish natural reachability or playability.

Historical Adobe Flash Player equivalence, natural post-level-10 play, stopped-miss/early-Load clicks, arbitrary asynchronous desktop input timing, exact audiovisual timing and historical online services remain unverified. Other viewport scales/transforms and a fully naturally reached campaign are not demonstrated. See [accepted M4 scope, evidence and limits](milestones/m4-original-runtime-parity-closure.md#final-independent-review-and-closure) and [compatibility assumptions](compatibility-assumptions.md). The [M0.5 report](runtime-verification.md) retains its original blocked findings; later evidence does not retroactively change them.
