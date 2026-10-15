# AGENTS.md

Instructions for coding agents working in CurveballNext. Read [docs/project-status.md](docs/project-status.md) first; it is the map of the project.

## What this is

An independent reimplementation of the 2002 Flash game Curveball: TypeScript, Vite, Canvas and Web Audio in the browser. Only Classic (single-player) is live. The private online mode (M5/M6) was retired on 15 October 2026: its client, server, Fly files and fairness tooling were removed from the tree and remain in the Git history before that change.

## Hard boundaries

- Never copy or redistribute anything from the original game (SWF, ActionScript, art, sound, fonts). `reference-local/` and `captures-local/` are private and git-ignored; do not commit or publish them. See [docs/project-boundaries.md](docs/project-boundaries.md).
- Game rules come from [docs/original-behavior.md](docs/original-behavior.md) and [docs/compatibility-assumptions.md](docs/compatibility-assumptions.md). Do not change simulation behavior without evidence; it was matched frame by frame to Ruffle v0.6.0 (M4).
- Do not claim Adobe Flash Player equivalence; it is unproven.

## Needs the maintainer's explicit authorization first

- Anything that spends money or creates a hosted service (for example bringing the online server back on Fly.io).
- Merging to `main`. Cloudflare Pages auto-deploys `main` to production (`curveballnext.pages.dev`), so a merge publishes immediately.
- Posting or publishing anything public, and changing accounts, tokens or settings. Never put tokens or secrets in the repository, command arguments or Vite variables.
- Work on a branch and open a pull request; do not push to `main`.

## The retired online mode

Do not restore online play without the maintainer's explicit decision: it needs a paid server. The history is in [the M5 plan](docs/milestones/m5-private-online-multiplayer-plan.md), [the M6 plan](docs/milestones/m6-multi-region-plan.md) and the [runbook](docs/m5-runbook.md), which records the shutdown.

## Verifying changes

- Commands: `npm test`, `npm run typecheck`, `npm run build`.
- The maintainer's Windows machine may not have Node on PATH. If you cannot run them locally, rely on CI: `.github/workflows/ci.yml` runs tests, typecheck and build on pull requests.
- Visual changes: check the Cloudflare Pages branch preview.
- Classic must keep working offline: it opens no network connection.

## Conventions

- Site and game copy are in English. Documentation is English.
- Keep documentation honest: record what was verified and what was not, with dates, as the existing milestone documents do. Update [docs/project-status.md](docs/project-status.md) when a milestone or deployment changes.
- Match the surrounding code's style and comment density. Keep pull requests small and focused.
- `promo/` holds local promotional material and is not part of the product.

## Working with the maintainer

The maintainer is a beginner developer and prefers explanations in plain Portuguese (Brazil), short and concrete. They are the decision maker for cost and launch questions: present a recommendation, not a survey of options.
