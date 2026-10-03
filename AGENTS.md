# AGENTS.md

Instructions for coding agents working in CurveballNext. Read [docs/project-status.md](docs/project-status.md) first; it is the map of the project.

## What this is

An independent reimplementation of the 2002 Flash game Curveball: TypeScript, Vite, Canvas and Web Audio in the browser, plus a small authoritative Node WebSocket server for private 1×1 online rooms. Classic (single-player) and Online are both live.

## Hard boundaries

- Never copy or redistribute anything from the original game (SWF, ActionScript, art, sound, fonts). `reference-local/` and `captures-local/` are private and git-ignored; do not commit or publish them. See [docs/project-boundaries.md](docs/project-boundaries.md).
- Game rules come from [docs/original-behavior.md](docs/original-behavior.md) and [docs/compatibility-assumptions.md](docs/compatibility-assumptions.md). Do not change simulation behavior without evidence; it was matched frame by frame to Ruffle v0.6.0 (M4).
- Do not claim Adobe Flash Player equivalence; it is unproven.

## Needs the maintainer's explicit authorization first

- Anything that spends money or changes the live service: `fly deploy`, creating or scaling Fly Machines or regions, changing Fly config or secrets. Procedure and rules: [docs/m5-runbook.md](docs/m5-runbook.md).
- Merging to `main`. Cloudflare Pages auto-deploys `main` to production (`curveballnext.pages.dev`), and `VITE_ONLINE_URL` is set for production, so a merge publishes immediately.
- Posting or publishing anything public, and changing accounts, tokens or settings. Never put tokens or secrets in the repository, command arguments or Vite variables.
- Work on a branch and open a pull request; do not push to `main`.

## How the online part works

Short version; details in [the M5 plan](docs/milestones/m5-private-online-multiplayer-plan.md) and the [runbook](docs/m5-runbook.md).

- Client connects to `wss://curveballnext.fly.dev/online`. Protocol 1 and rules `online-v1` must match on both sides. The server accepts only exact origins listed in `ALLOWED_ORIGINS`; branch preview URLs are not allowed, so previews cannot reach the server unless their origin is added.
- Two Fly Machines, one per region, are independent authorities with in-memory rooms: `gru` (codes start with `G`) and `iad` (codes start with `V`). The client reads the code prefix and connects with `?r=<region>`; the wrong Machine answers `fly-replay` so the right one upgrades. Plan: [M6](docs/milestones/m6-multi-region-plan.md).
- Fairness: the authority is simulated at 30 Hz; a defender is protected from network delay by a bounded contact claim (M5 plan §5). Its accepted limits are listed in project-status. Do not weaken the fairness gate (`tools/m5/fairness-ci.sh`, which fails a cell on any false acceptance).
- Local run: `npm ci`, `npm run dev`, and `npm run server:dev` in a second terminal. Use two visible windows (a hidden tab closes its session by design).

## Verifying changes

- Commands: `npm test`, `npm run typecheck`, `npm run build`, `npm run server:build`.
- The maintainer's Windows machine may not have Node on PATH. If you cannot run them locally, rely on CI: `.github/workflows/m5-linux.yml` runs tests, typecheck, build and the fairness cells on pull requests. Pushing the same commit to the branch `m5-fairness-full` runs all 16 fairness cells (about 17 minutes).
- The `fairness (C3)` job can flake on a realized-margin stratum check; re-run the failed job once before investigating.
- Visual changes: check the Cloudflare Pages branch preview.
- Classic must keep working offline: it lazy-loads and opens no WebSocket.

## Conventions

- Site and game copy are in English. Documentation is English.
- Keep documentation honest: record what was verified and what was not, with dates, as the existing milestone documents do. Update [docs/project-status.md](docs/project-status.md) when a milestone or deployment changes.
- Do not chase isolated 1-in-thousands instrumentation outliers in fairness runs; the maintainer has accepted that trade-off.
- Match the surrounding code's style and comment density. Keep pull requests small and focused.
- `promo/` holds local promotional material and is not part of the product.

## Working with the maintainer

The maintainer is a beginner developer and prefers explanations in plain Portuguese (Brazil), short and concrete. They are the decision maker for fairness, cost and launch questions: present a recommendation, not a survey of options.
