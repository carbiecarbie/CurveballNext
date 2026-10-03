# M6 — multi-region room routing (plan)

Status: **code merged (PR #4) and deployed to two Machines, `gru` and `iad` (2 October 2026; see the deployment record in [the runbook](../m5-runbook.md)).** Replay from `gru` to `iad` is verified; per-region qualification and a real (non-VPN) US-player latency figure are still open (gate 5 below); cross-region play in both directions was reported working by the maintainer.

## Goal
Players far from São Paulo get a nearby authority. One Fly app runs one independent Machine per approved region (initially `gru` and `iad`). A room is created on the Machine nearest its creator and lives there; anyone joining it is routed to that Machine. No state is shared between regions. This follows the maintainer direction recorded in the [M5 plan](m5-private-online-multiplayer-plan.md) (1 October 2026).

## Mechanism
- **Region in the room code.** On a Machine whose `FLY_REGION` is mapped, the first of the 12 code characters is that region's symbol (`G` = `gru`, `V` = `iad`; table in `src/multiplayer/regions.ts`). Unmapped regions and local development never emit a region symbol. Code entropy on mapped Machines drops from 60 to 55 bits; rooms are short-lived and rate-limited per IP (create 3/min, join 20/min), so this is not a meaningful change.
- **Create.** The client connects to the single public endpoint. Fly's anycast delivers it to the nearest Machine with capacity, and the room is born there.
- **Join.** The room code arrives only in the first WebSocket message, after the upgrade, so it cannot drive routing. The client therefore reads the code's prefix and connects with `wss://APP.fly.dev/online?r=<region>`. A Machine in a different region answers `fly-replay: region=<r>` and does **not** upgrade (Fly: a replaying instance must not negotiate the WebSocket upgrade). The ingress retries on the owning Machine, which upgrades normally. Only the region name is in the URL, never the code.
- **Loop guard.** A request that was already replayed (`fly-replay-src` present) and still names another region is refused with 421.
- **Validation.** `/online` and `/online?r=<known region>` are the only accepted upgrade targets. Origin, rate-limit and `fly-client-ip` handling are unchanged and run on the Machine that upgrades. A replay is not counted against the sender's limits on the first Machine.
- **Players see the cost.** The invite line names the server region, and pre-join errors (`full`, `capacity`, `room-unavailable`, `invalid-code`, `maintenance`, `retry-later`) have plain-language text.

## Not in scope
Matchmaking or choosing a region that is best for both players; shared state or room migration between regions; rewind lag compensation; host migration; recovery after restart. A cross-continent pair still pays the physical round trip wherever the room lives, and the [M5 envelope](m5-private-online-multiplayer-plan.md) (RTT ≤ 100 ms) still applies per pair.

## Capacity and cost
Caps stay per Machine (10 rooms, 20 players, 64 sockets), so total capacity is the sum. Each added Machine is another always-on shared-cpu-1x/512 MB, roughly the cost of the first one; confirm against current Fly pricing before authorizing (dated 2026-10-02 estimate: a few US dollars per month per Machine, region-dependent). Egress remains the cost that scales with players.

## Implemented so far (PR #4)
Region table and endpoint helper (`src/multiplayer/regions.ts`), prefixed code generation (`server/authority.ts`), URL parsing and replay decision (`server/index.ts`), client endpoint and error text (`src/multiplayer/ui.ts`, `client.ts`), tests (`tests/m6-region-routing.test.ts`: prefix mapping, URL parsing, replay, loop refusal, normal upgrade over loopback). The test proves the server emits the right header; it does not prove Fly's ingress follows it for a WebSocket upgrade.

## Remaining work and gates
1. **Independent review** of PR #4 and this document.
2. **Authorization to spend**: a maintainer approves the added Machine and budget, and the choice of the US region (`iad` or `ord`, by RTT measured from the target audience; changing it means changing the symbol table).
3. **Deploy a second Machine** in the US region with the same image, `auto_stop_machines = "off"`, no HA autoscaling (runbook section "Multi-region deployment").
4. **Real replay check**: create in `gru`, join from a US network, confirm in logs that the room lives on the `gru` Machine and the US Machine never upgraded; repeat in the opposite direction. Check that a join naming a region with no running Machine fails cleanly (the join-side error, not a hang).
5. **Per-region qualification**: the runbook's ≥60-minute real-Machine run and the fairness cells for each region, plus a recorded RTT for the intended player pairs.
6. **Rollback proven**: with `VITE_ONLINE_URL` unchanged, scaling back to one Machine must leave `gru` codes working. Codes naming a removed region return `room-unavailable`.

## Risks
- `fly-replay` on a WebSocket upgrade is documented but unverified for this app (gate 4).
- A mapped Machine restarting aborts its rooms, as in M5; with two Machines an outage is partial, not total.
- A client older than this change connects without `?r`, so it can join a room only on the Machine it lands on; mixed versions during rollout can see `room-unavailable` for cross-region codes. Deploy the frontend after both Machines run the new server.
