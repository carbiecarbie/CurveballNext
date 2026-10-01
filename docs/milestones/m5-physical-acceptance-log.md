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

## Real-display cadence run

Same day, on the maintainer's physical 144 Hz display (NVIDIA RTX 5080, 3840×2160), local loopback (profile C0, no shaping), Chromium 154 browser in the foreground, one stratum per run with the display switched to that refresh rate (`?hz=` filter). 600 opportunities (300 per defender) captured; the independent verifier reported no failures and classified all 600 as apparent contact accepted (cells stay incomplete until independent image corroboration). This capture used the earlier estimate-based stimulus scheduler; re-verified under the later nearest-stratum margin rule, 5 of 600 observations (all accepted contacts, declared 50 ms, shown 76.9–77.9 ms) fall nearer the 100 ms stratum. The cadence results are unaffected.

| Stratum | Opportunities | Frame intervals | Target | Median | p5–p95 | p99 | Within ±2 ms |
|---|---|---|---|---|---|---|---|
| 60 Hz | 200 | 14,938 | 16.67 ms | 16.7 ms | 16.5–16.8 ms | 16.9 ms | 100% |
| 120 Hz | 200 | 30,035 | 8.33 ms | 8.3 ms | 8.2–8.4 ms | 8.5 ms | 99.7% |
| 144 Hz | 200 | 36,114 | 6.94 ms | 7.0 ms | 6.9–7.0 ms | 7.1 ms | 100% |

## Not covered by this session

- Route measurements (step 2: RTT, one-way variation, loss) were not recorded; only the network types and cities are known.
- The exact Firefox version and the computer-to-column mapping above were not recorded.
- Steps 7–8 (final-delivery ordering across backend restart, ≥64 KiB backpressure, expiry timers) need the controlled harness/staging session, outside a two-player match.

Physical matches neither replace nor populate the controlled cells. Controlled-cell evidence for the final presentation code: CI run 36927365770 on `dc343a4` (realized-margin verification in force): 4,799 of 4,800 observations valid, 0 apparent-contact rejections, 0 false acceptances. The single remaining observation, C5b/0/009 (declared 100 ms, shown 71.9 ms under 1% loss), is an instrumentation timing outlier; by maintainer decision on 1 October 2026 it is recorded here rather than chased. An attempt to repeat such attempts automatically (`bdd9433`) broke the capture page under loss and was reverted (`1a33b3a`); the code equals `dc343a4`.

## Independent review

Independent review by Codex (OpenAI), in rounds on 1 October 2026: the contact-claim amendment (P1–P8; P1/P2 accepted as a private-room risk), the incoming-ball amendment (`3fe5d60`, `5e05f4e`) and its fixes (`9bc679b`, `190c2fd`, `bd38f21`, `4977e14`, `2e9a06a`). Each round's confirmed findings were fixed with regression tests. The final recheck of `2e9a06a` confirmed the previous findings resolved and found one gap (interleaved claims replacing the first claim of a tick), fixed in `4427736` with a regression test; by maintainer decision the review is closed there without a further recheck. Accepted risks, recorded in the plan §5: a modified client can widen the claim envelope (P1/P2) and can pause the room by withholding claims at its own returns. The deployed 60-minute soak passed (see the runbook deployment record).
