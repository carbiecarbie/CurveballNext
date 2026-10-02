# Project status

CurveballNext was built in milestones. Each was accepted only after its listed checks passed; the milestone documents hold the full evidence.

| Milestone | Scope | Status |
|---|---|---|
| M0 / M0.5 | Static reconstruction of the original rules; an attempt to verify them against a running original (blocked, kept as a historical report) | Done |
| M1 | Faithful offline prototype: deterministic 30 Hz rally, curve physics, replay traces | Accepted (105 tests, typecheck, build, replay, Edge smoke) |
| M2 | Single-player loop: lives, score buckets, level time bonus, ten difficulty entries, game over, restart | Accepted |
| M3 | Original presentation: neon court, orb, glass paddles, HUD, bonus notices, synthesized sounds | Accepted after physical visual/audio review, 30 Sep 2026 |
| M4 | Parity with the pinned Ruffle v0.6.0 runtime | Accepted after independent review, 30 Sep 2026 |
| M5 | Private online multiplayer (1×1 rooms) | Accepted and **live**, 1 Oct 2026 |
| Visual refresh | New court, orb and paddle look (magenta opponent) | Merged, 2 Oct 2026 |

## What is verified

- **M4.** Against Ruffle v0.6.0 (`cac5c99ce4a17e606f4ee3090389bb878f852055`) all 63 recorded sessions (5,371 frames, 192,372 observations) were rerun with 759 matching comparison components. Callback order, display coordinates, bounds and rewind behavior match.
- **M5.** Linux CI fairness runs: 4,800 controlled defender opportunities, 0 rejected, 0 falsely accepted (one margin outlier accepted by the maintainer). Real-display cadence at 60, 120 and 144 Hz: 600/600 accepted. Physical test: ten matches between Rio and Brasília, both players approved. See [physical acceptance log](milestones/m5-physical-acceptance-log.md).

## What is not verified

- Equivalence with the historical Adobe Flash Player.
- Natural play beyond level 10. Level 10 ends the campaign by a deliberate CurveballNext choice, because the original has no verified ending.
- Early or stopped-miss clicks, arbitrary asynchronous desktop input, exact audiovisual timing and the original's online services.
- Online play with modified clients: a tampered client can widen its own late-return window. This was accepted for private rooms and must be reopened before any public matchmaking or ranking.

## Not implemented

Local score table, online ranking, reconnect after refresh, accounts, music.

## Hosting

Frontend on Cloudflare Pages (auto-deploys `main`); a single Fly.io Machine in São Paulo runs the online authority. Rooms live in memory and disappear on restart. See the [runbook](m5-runbook.md).

## Document map

- [M1 acceptance](m1-acceptance.md) · [M2](milestones/m2-complete-single-player-loop.md) · [M3](milestones/m3-complete-original-offline-presentation.md) · [M4](milestones/m4-original-runtime-parity-closure.md)
- [M5 plan](milestones/m5-private-online-multiplayer-plan.md) · [M5 candidate evidence](milestones/m5-implementation-candidate.md) · [M5 physical acceptance guide](m5-physical-acceptance.md)
- [Runtime verification (M0.5, historical)](runtime-verification.md)
