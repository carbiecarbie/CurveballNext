#!/usr/bin/env bash
# Test-only receiver-ingress shaping; run in isolated Linux test namespaces/VMs.
set -euo pipefail
if [[ $# != 10 ]]; then
  echo 'usage: ingress-netem.sh DEVICE IFB PEER_IP upstream|downstream PORT BASE_MS JITTER_MS LOSS_PERCENT SEED FILTER_PREF' >&2
  exit 2
fi
device=$1; ifb=$2; peer=$3; direction=$4; port=$5; delay=$6; jitter=$7; loss=$8; seed=$9; preference=${10}
[[ "$device" =~ ^[a-zA-Z0-9_.-]+$ && "$ifb" =~ ^cbm5[a-z0-9]+$ && ${#ifb} -le 15 ]] || exit 2
[[ "$peer" =~ ^[0-9.]+$ && "$port" =~ ^[0-9]+$ && "$delay" =~ ^[0-9]+$ && "$jitter" =~ ^[0-9]+$ && "$loss" =~ ^[0-9.]+$ && "$seed" =~ ^[0-9]+$ && "$preference" =~ ^[0-9]+$ ]] || exit 2
case "$direction" in upstream) selector=dst_port ;; downstream) selector=src_port ;; *) exit 2 ;; esac
ip link add "$ifb" type ifb
ip link set "$ifb" up
if ! tc qdisc show dev "$device" | grep -q ingress; then tc qdisc add dev "$device" handle ffff: ingress; fi
tc filter add dev "$device" parent ffff: protocol ip pref "$preference" flower ip_proto tcp src_ip "$peer" "$selector" "$port" action mirred egress redirect dev "$ifb"
# netem jitter is uniform when no distribution table is named; there is no "uniform" table.
tc qdisc add dev "$ifb" root netem limit 1000 delay "${delay}ms" "${jitter}ms" loss random "${loss}%" rate 1mbit seed "$seed"
tc -s qdisc show dev "$ifb"
# Cleanup after retaining tc statistics and packet captures:
# tc filter del dev DEVICE parent ffff: protocol ip pref FILTER_PREF
# ip link del IFB
# Do not delete a shared interface's unrelated qdiscs/filters.
