# Project Boundaries

This project is an independent implementation inspired by the gameplay concepts of the 2002 Flash game Curveball.

The original SWF and related extracted material are reference-only. Do not copy or redistribute original ActionScript, graphics, sounds, fonts, animations, or other original assets.

Write the implementation independently from the behavioral specification in `docs/original-behavior.md`. The original SWF may be used only for behavioral verification and runtime comparison.

M0 static reconstruction is complete. M0.5 runtime verification is currently incomplete. The Simulation Contract v1 is **not frozen**.

The following runtime compatibility questions remain unresolved:

- U01: exact native field dimensions;
- U02: display quantization and `hitTest` edge behavior;
- U03: cross-clip `EnterFrame` ordering;
- U04: `MouseDown` ordering;
- U05: paddle instance retention.

These assumptions must not be silently treated as verified behavior. The M0.5 report records six priority gameplay tests as inconclusive; see `docs/runtime-verification.md`.
