#!/usr/bin/env bash
# Test-only: one controlled-capture profile on a single disposable Linux host (CI runner).
# Topology: the fairness authority runs in network namespace cbm5srv. The headless browser stays in the
# root namespace and reaches the authority over two separate veth links, one per player:
#   player A: ra (10.55.1.2) <-> sa (10.55.1.1)      player B: rb (10.55.2.2) <-> sb (10.55.2.1)
# ingress-netem.sh shapes each direction on its receiver: upstream on sa/sb (server side), downstream on
# ra/rb (client side). Only WebSocket TCP port 8787 is shaped; the fixture API (9055) and Vite stay unshaped.
# usage: sudo-capable shell; bash tools/m5/fairness-ci.sh PROFILE [LIMIT]
set -euo pipefail
profile=$1; limit=${2:-300}
node=$(command -v node)
out="captures-local/m5-ci/$profile"; mkdir -p "$out"

read -r aub auj adb adj al bub buj bdb bdj bl pi < <(PROFILE="$profile" "$node" --input-type=module -e "
const { profiles } = await import('./tools/m5/fairness.ts');
const p = profiles[process.env.PROFILE]; if (!p) { console.error('unknown profile'); process.exit(2); }
console.log([...p[0], ...p[1], Object.keys(profiles).indexOf(process.env.PROFILE)].join(' '));")
# Independent predeclared seeds for the four directed paths.
seed=$((70001 + pi * 10))
echo "profile=$profile A up=${aub}/${auj} down=${adb}/${adj} loss=${al}% | B up=${bub}/${buj} down=${bdb}/${bdj} loss=${bl}% | seeds ${seed}..$((seed + 3))" | tee "$out/shape-plan.txt"

pids=()
cleanup() { for p in "${pids[@]}"; do sudo kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

sudo modprobe sch_netem; sudo modprobe ifb numifbs=0
sudo ip netns add cbm5srv
sudo ip -n cbm5srv link set lo up
for side in a b; do
  n=$([[ $side == a ]] && echo 1 || echo 2)
  sudo ip link add "r$side" type veth peer name "s$side"
  sudo ip link set "s$side" netns cbm5srv
  sudo ip addr add "10.55.$n.2/24" dev "r$side"; sudo ip link set "r$side" up
  sudo ip -n cbm5srv addr add "10.55.$n.1/24" dev "s$side"; sudo ip -n cbm5srv link set "s$side" up
  # Shape real wire-sized segments rather than offloaded super-packets.
  sudo ethtool -K "r$side" gro off gso off tso off >/dev/null 2>&1 || true
  sudo ip netns exec cbm5srv ethtool -K "s$side" gro off gso off tso off >/dev/null 2>&1 || true
done

# Runner iproute2 lacks netem "seed"; apply qdiscs with a newer iproute2 against the same namespaces.
docker build -q -t cbm5-tc - >/dev/null <<'EOF'
FROM debian:trixie
RUN apt-get update -qq && apt-get install -y -qq iproute2 >/dev/null
EOF
tcx() { docker run --rm --privileged --network host -v /var/run/netns:/var/run/netns -v "$PWD:/w" -w /w cbm5-tc "$@"; }
tcx tc -V > "$out/tc-version.txt"
tcx ip netns exec cbm5srv bash tools/m5/ingress-netem.sh sa cbm5ua 10.55.1.2 upstream 8787 "$aub" "$auj" "$al" "$seed" 10 > "$out/tc-a-up.txt"
tcx bash tools/m5/ingress-netem.sh ra cbm5da 10.55.1.1 downstream 8787 "$adb" "$adj" "$al" $((seed + 1)) 10 > "$out/tc-a-down.txt"
tcx ip netns exec cbm5srv bash tools/m5/ingress-netem.sh sb cbm5ub 10.55.2.2 upstream 8787 "$bub" "$buj" "$bl" $((seed + 2)) 10 > "$out/tc-b-up.txt"
tcx bash tools/m5/ingress-netem.sh rb cbm5db 10.55.2.1 downstream 8787 "$bdb" "$bdj" "$bl" $((seed + 3)) 10 > "$out/tc-b-down.txt"

# Packet headers before (veth) and after (ifb) shaping for every direction.
for dev in ra rb cbm5da cbm5db; do sudo tcpdump -i "$dev" -s 96 -w "$out/$dev.pcap" tcp port 8787 >/dev/null 2>&1 & pids+=($!); done
for dev in sa sb cbm5ua cbm5ub; do sudo ip netns exec cbm5srv tcpdump -i "$dev" -s 96 -w "$out/$dev.pcap" tcp port 8787 >/dev/null 2>&1 & pids+=($!); done

sudo ip netns exec cbm5srv sudo -u "$USER" env PROFILE="$profile" FAIRNESS_HOST=0.0.0.0 "$node" dist-server/fairness-server.mjs > "$out/server.log" 2>&1 & pids+=($!)
"$node" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort > "$out/vite.log" 2>&1 & pids+=($!)
# Unshaped control-plane relay so the page keeps its loopback fixture API origin.
"$node" -e "const net = require('node:net'); net.createServer(c => { const s = net.connect(9055, '10.55.1.1'); c.pipe(s).pipe(c); s.on('error', () => c.destroy()); c.on('error', () => s.destroy()); }).listen(9055, '127.0.0.1');" & pids+=($!)
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:9055/manifest && curl -sf -o /dev/null http://127.0.0.1:5173/ && break; sleep 1; done

started=$(date +%s)
status=0
"$node" tools/m5/fairness-driver.mjs ws://10.55.1.1:8787/online ws://10.55.2.1:8787/online "$limit" | tee "$out/driver.log" || status=$?
echo "capture seconds: $(( $(date +%s) - started ))" | tee -a "$out/driver.log"

for dev in cbm5da cbm5db; do tcx tc -s qdisc show dev "$dev"; done > "$out/tc-stats-down.txt"
for dev in cbm5ua cbm5ub; do tcx ip netns exec cbm5srv tc -s qdisc show dev "$dev"; done > "$out/tc-stats-up.txt"
cleanup; pids=()
sleep 1

run=$(grep -o '"directory":"[^"]*"' "$out/server.log" | cut -d'"' -f4)
echo "$run" > "$out/run-directory.txt"
"$node" dist-server/verify-fairness.mjs "$run" > "$out/verify.log" 2>&1 || true
exit "$status"
