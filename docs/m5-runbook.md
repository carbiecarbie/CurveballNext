# M5 candidate setup and release runbook

Status: implementation candidate; **not accepted, provisioned or deployed**. The accepted M5 plan is unchanged. Independent implementation review, controlled network/fairness evidence, deployed capacity and physical acceptance remain release gates. Original M3/M4 acceptance and its historical Flash/evidence limitations remain unchanged.

## Local startup

Use Node 24.19.0 (the tested local runtime) and npm with the committed lockfile:

```text
npm ci
npm test
npm run typecheck
npm run build
npm run server:build
npm run server:start
```

In another terminal run `npm run dev`. Open `http://127.0.0.1:5173/`. Development defaults to `ws://127.0.0.1:8787/online`; a public endpoint override is `VITE_ONLINE_URL`. `/healthz` on port 8787 returns room/socket counts and compatibility versions. Create a room, copy its invitation, open it in a second **visible window**, Join, then Ready on both. A hidden tab closes its session by design. Each browser owns its near cyan paddle; the green far paddle is the opponent. Countdown is automatic. There are exactly three lives per side. Both must request a rematch within 60 seconds. No rejoin or result persistence across refresh exists.

Where npm is absent from PATH, equivalent validation is `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/typescript/bin/tsc -p tsconfig.server.json`, `node node_modules/vite/bin/vite.js build`, and `node tools/m5/build-server.mjs`. `node dist-server/server.mjs` starts the backend. Do not use Vite preview as a production authority.

See [controlled qualification tooling](../tools/m5/README.md). Capture tools are excluded from both production builds. Docker and Linux netem were unavailable on the implementation host; no container build or packet-loss gate is claimed. The 60-second local in-process load report is distinct from a one-hour real hosting soak.

## Configuration and ownership

Backend configuration: `PORT` (8787), `HOST` (loopback locally, 0.0.0.0 in container), `NODE_ENV`, exact comma-separated `ALLOWED_ORIGINS`, and `TRUST_FLY_PROXY=1` **only behind established Fly ingress**. Never expose the private backend listener through another path while trusting `Fly-Client-IP`. Direct local tests use the socket's remote address. Missing/foreign Origin is rejected. Production requires HTTPS origins and Fly TLS termination; browsers use `wss://APP.fly.dev/online`. Compression is disabled. No application account credential is configured.

Frontend configuration: public `VITE_ONLINE_URL=wss://APP.fly.dev/online`. No secrets in Vite variables. Protocol 1 and rules `online-v1` must match; an incompatible/missing endpoint gives an actionable setup/update error. Classic lazy-loads its unchanged runtime and opens no WebSocket or heartbeat.

Record the actual frontend URL, whether it is Pages/Workers Static Assets/another arrangement, project/account, build command, output directory, deployed headers and publication method. Repository evidence establishes static Vite output, not the Cloudflare product. Add the exact backend endpoint to the service's real CSP `connect-src`, for example `connect-src 'self' wss://APP.fly.dev`; preserve its other existing directives. Verify actual response headers and WSS in a browser. Do not add a guessed `_headers`/Wrangler deployment flow.

The authority is one process on **one always-running Machine in `gru` (São Paulo)**, initially shared-cpu-1x/512 MB. In-memory rooms disappear on restart. No volumes/database, extra replica, distributed routing or auto-stop. `fly.m5.toml` and Dockerfile are review templates with placeholders. Record the base image digest before release; the pinned version-tag container has not been built here.

## Account and publication steps — future authorization only

Do not execute this section without separate maintainer authorization for account setup, paid operation and publication. A maintainer must own/select the Fly organization, complete its account/payment setup, inspect `gru` availability and obtain a current regional quote. If São Paulo capacity is unavailable, stop for an explicit release decision; do not change region. Install the official Fly CLI and Docker locally; record their versions. Maintainer performs normal login; keep tokens out of repository, shell command arguments, diagnostic exports and frontend variables.

1. Complete independent review and local qualification. Set the actual app name and exact frontend Origin in a reviewed copy of `fly.m5.toml`; review the container/base digest and budget.
2. After authorization, create the app with `fly apps create APP --org ORG`. No database, dedicated IPv4, volume or remote builder is required. Verify the chosen organization and account before continuing.
3. Validate config with `fly config validate --config fly.m5.toml`. Build locally with `docker build -t curveball-m5:CANDIDATE .`, or let `fly deploy` use Fly's default remote (Depot) builder, which needs no local Docker; inspect the final image for only `server.mjs`, Node runtime and locked production dependency. The whitelist `.dockerignore` excludes original references, captures, .git and environment files.
4. Publish with `fly deploy --config fly.m5.toml --local-only --ha=false --strategy immediate --primary-region gru` (omit `--local-only` for the remote builder). This step provisions/publishes and may spend money; it is deliberately not run by this implementation task. Verify exactly one Machine using `fly machines list --app APP`; if needed use `fly scale count 1 --app APP --region gru` during maintenance. Do not add a second authority to improve availability.
5. Verify `fly status --app APP`, `fly checks list --app APP`, region, CPU/RAM, auto-stop off, proxy 48/64 connection limits and 600-second idle timeout. Check `https://APP.fly.dev/healthz`, valid WSS Origin, rejected foreign/missing Origin, compatibility, no reconnect, five-second failure and bounded cleanup. Confirm the established proxy client IP header before enabling trusted-IP limits.
6. Qualify the real single Machine for ≥60 minutes after shared-CPU burst credit is exhausted: ten rooms including Waiting/end/slow/unbound connections, scheduler p99≤10 ms, batch p99<20 ms, RSS<70% of 512 MB, bounded queues and zero overrun aborts. Local CPU results do not prove this. If it fails, stop publication; a lower cap or larger single Machine and revised budget require review.
7. Build the frontend with the exact public WSS setting, verify CSP/version behavior, inspect static output for private assets/backend code, and publish through the verified existing host mechanism. Verify Classic with networking blocked. Complete controlled cells and the separate [physical guide](m5-physical-acceptance.md), then obtain independent review and maintainer acceptance before milestone closure.

Current CLI flag and HTTP concurrency/idle-timeout references: [Fly deploy](https://docs.fly.io/flyctl/cmd/fly_deploy), [scale count](https://docs.fly.io/flyctl/cmd/fly_scale_count), [configuration](https://docs.fly.io/reference/configuration/), checked 1 October 2026. Recheck installed CLI help before an authorized release.

**Deployment record, 1 October 2026.** Maintainer-authorized: app `curveballnext` in the personal organization, one `shared-cpu-1x:512MB` Machine in `gru`, built by the default remote builder (68 MB image), shared IPv4/IPv6, `wss://curveballnext.fly.dev/online`. Allowed origins: `https://curveballnext.pages.dev` and the `https://m5-candidate.curveballnext.pages.dev` preview alias. Verified: one Machine, health check passing, HTTP→HTTPS redirect, WSS upgrade 101 for both allowed origins, 403 for foreign/missing Origin, and two real protocol clients reaching Rally (≈19 ms RTT from the maintainer's network) with rooms back to 0 after leaving. Step 6 (60-minute post-burst soak) and step 7 remain open. The production Pages site still publishes `main` (offline); online testing uses the preview with `VITE_ONLINE_URL` set for the Preview environment only.

## Operations, limits, costs and rollback

Application caps are fixed: 10 rooms/20 players/64 sockets; unauthenticated bind within 5 seconds; Waiting 10 minutes; rematch 60 seconds; absolute room TTL one hour. Frames ≤1 KiB; snapshots ≤2 KiB. Pending targets and unsent snapshots coalesce. Lifecycle queues ≤32, input history ≤60/two seconds, diagnostics ≤600 records. Inputs 30/s burst60; other commands5/s burst10. IP create3/minute, join20/minute, upgrade30/minute and at most10 unbound sockets; limiter map≤10,000. These are basic abuse protections, not DDoS protection or enforceable financial caps. Shared-NAT players may receive Retry later.

The server logs one startup line and one aggregate health line/minute, never codes/credentials/IPs. `/healthz` is 503 during drain/unhealthy scheduling. Monitor Fly health/restarts, CPU quota/event-loop lateness, RSS, queue/congestion/overrun counters, valid runtime beats, payload/egress and invoices. Preserve bounded/redacted diagnostics for disputes. A Node process stall/death cannot guarantee immediate server cleanup; both clients have independent watchdogs.

The plan's dated small-use estimate is about US$6.13/month (always-on shared512 MB plus15 room-hours), excluding taxes/FX/frontend/domain/support. US$10 is a planning budget, not authorization or a hard billing limit. The latest60-second local run measured average snapshot about1,035 bytes and maximum1,266: near the1 KiB planning assumption, with every snapshot under the2 KiB hard cap. TCP/TLS/lifecycle/abuse traffic still needs measurement. Local scheduler lateness p99 was15.46 ms, exceeding the10 ms target; this run is **not a capacity pass**. See the [candidate evidence report](milestones/m5-implementation-candidate.md). The illustrative100-room estimate is not release capacity. Requote São Paulo, inspect account allowances and review spending separately. Alerts and room caps cannot stop every provider charge.

Drain for an announced replacement: `fly ssh console --app APP --command "kill -USR2 1"` (verify PID1 is the Node authority first). It refuses creates/new starts/rematches while bounded matches finish; Waiting/end rooms expire normally, and the absolute TTL bounds drain. Observe rooms reach zero, then replace the single Machine with a compatible image using immediate strategy. SIGTERM sends interruption, revokes ownership, and forces lingering sockets within the cleanup budget. Unexpected restart aborts unfinished matches; a validated result remains in that browser session, while undelivered finish is outcome unknown.

For urgent disable, publish a reviewed frontend build with `VITE_ONLINE_URL` unset (Online gives setup error; Classic remains available), drain/stop the separately authorized backend, and verify offline Classic. Stopping a Machine can still incur disk/other provider charges. Roll back both compatible frontend and backend versions, for example `fly deploy --app APP --config fly.m5.toml --image APPROVED_PREVIOUS_IMAGE --ha=false --strategy immediate`, during maintenance. An old image cannot recover in-memory rooms or undelivered outcomes.
