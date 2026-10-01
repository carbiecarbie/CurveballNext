# M5 physical acceptance log

Record of the maintainer's physical acceptance session under [the physical guide](../m5-physical-acceptance.md). Reported by the maintainer; no IPs, credentials or room codes are retained.

## Session

| Item | Value |
|---|---|
| Date | 1 October 2026, from 15:11 (America/Sao_Paulo) |
| Build | `m5-candidate` preview, `https://m5-candidate.curveballnext.pages.dev`, with the incoming-ball amendment (commit `5e05f4e`) |
| Backend | Fly app `curveballnext`, one Machine in `gru`, protocol 1, rules `online-v1` |
| Networks | Two different networks and cities: Rio de Janeiro and Brasília, each on wired broadband |

| Tester computer | Player A | Player B |
|---|---|---|
| OS | Bazzite (Linux) | Windows 11 |
| Browser | Firefox (reported as the latest release, about 157; exact version not verified) | Microsoft Edge 154.0.4258.37 |
| Real mouse | yes | yes |
| Display | 144 Hz | 144 Hz |

## Ten complete matches

Final lives, Player A × Player B. Which column maps to which computer was not recorded.

| Match | Final lives | Winner |
|---|---|---|
| 1 | 2 × 0 | A |
| 2 | 1 × 0 | A |
| 3 | 3 × 0 | A |
| 4 | 3 × 0 | A |
| 5 | 0 × 1 | B |
| 6 | 0 × 3 | B |
| 7 | 2 × 0 | A |
| 8 | 2 × 0 | A |
| 9 | 2 × 0 | A |
| 10 | 0 × 1 | B |

Every result is coherent (loser exactly 0, winner 1–3). Both players lost at least one match. The maintainer reports that every guide step was performed and behaved as specified: room creation/join, Full and invalid codes, pre-match leave/refresh, countdown and serve, lives 3→2→1→0 with the miss hold and countdown, point notices, rematches, 30-second visible blur, rapid focus toggles, fenced control until a new mouse sample, hidden page, Leave, refresh and disconnection. No contact was disputed, so no screen clips were required.

## Approvals

Both testers approved.

## Not covered by this session

- Route measurements (step 2: RTT, one-way variation, loss) were not recorded; only the network types and cities are known.
- The exact Firefox version and the computer-to-column mapping above were not recorded.
- Steps 7–8 (final-delivery ordering across backend restart, ≥64 KiB backpressure, expiry timers) need the controlled harness/staging session, outside a two-player match.

Physical matches neither replace nor populate the controlled cells (CI run 36889301190: all sixteen cells 300/300 accepted, 0 rejected, 0 false accepted). M5 still requires the real-display cadence run, the deployed 60-minute soak and independent review of the incoming-ball amendment before final acceptance.
