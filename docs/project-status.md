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
| M6 | Multi-region rooms: one authority Machine in `gru` and one in `iad`, room code names its region | Deployed 2 Oct 2026; `iad` 66-minute soak passed 3 Oct; fairness cells on `iad` and real US-player latency still open ([plan](milestones/m6-multi-region-plan.md)) |
| Landing page | Full landing page replaces the mode picker (hero clip, GitHub and Ko-fi links, link-preview image) | Merged, 3 Oct 2026 |

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

Frontend on Cloudflare Pages (auto-deploys `main`; other branches get preview URLs). The online authority is one Fly.io app, `curveballnext`, with one always-on Machine in São Paulo (`gru`, room codes start with `G`) and one in Virginia (`iad`, codes start with `V`). Each Machine is an independent authority; a join is routed to the room's Machine with `?r=<region>` and `fly-replay`. Rooms live in memory and disappear on restart. See the [runbook](m5-runbook.md) and the [M6 plan](milestones/m6-multi-region-plan.md).

The landing page is static markup in `index.html` with styles in `src/landing.css` (scoped under `#landing`); link-preview tags point to `public/og.jpg`. Site copy is in English. `.github/FUNDING.yml` and the hero links point to the maintainer's Ko-fi.

## Working rules and decisions

Agent-facing rules (authorization, deploy, verification) are in [AGENTS.md](../AGENTS.md). Decisions already taken, so they are not reopened by accident:

- **Modified-client late-return window (accepted).** Online fairness uses a bounded defender contact claim ([M5 plan §5 amendment](milestones/m5-private-online-multiplayer-plan.md)). A tampered client can inflate its own late-return window; closing that would reject honest late returns. Accepted for private invite-code rooms, to be reopened before any public matchmaking or ranking.
- **Defender interruption during the claim pause** commits the original miss first; opponent interruption still aborts.
- **Isolated instrumentation outliers** (about 1 in thousands of controlled cells) are not chased; the maintainer accepted the single margin outlier in the final runs.
- **Level 10 ends the campaign** by deliberate choice (the original has no verified ending).
- **Known small follow-up:** a socket the server closes without an `interrupted` frame (refused create, Waiting expiry) shows the client watchdog's "Server runtime timeout" instead of a specific reason.

## Document map

- [M1 acceptance](m1-acceptance.md) · [M2](milestones/m2-complete-single-player-loop.md) · [M3](milestones/m3-complete-original-offline-presentation.md) · [M4](milestones/m4-original-runtime-parity-closure.md)
- [M5 plan](milestones/m5-private-online-multiplayer-plan.md) · [M5 candidate evidence](milestones/m5-implementation-candidate.md) · [M5 physical acceptance guide](m5-physical-acceptance.md)
- [Runtime verification (M0.5, historical)](runtime-verification.md)
