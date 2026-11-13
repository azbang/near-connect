#!/usr/bin/env bash
# Median time screenTransaction adds before the wallet handoff, measured against live RPC.
# Usage: scripts/screen-latency.sh [mainnet|testnet] [runs]
set -euo pipefail
cd "$(dirname "$0")/.."
network="${1:-mainnet}"
runs="${2:-9}"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
corepack yarn -s tsc --noEmit false --outDir "$out" --rootDir . --module commonjs --target ESNext --strict --skipLibCheck --esModuleInterop --resolveJsonModule test/screen-latency.ts
for _ in $(seq "$runs"); do node "$out/test/screen-latency.js" "$network"; done | tee "$out/samples" >/dev/null
for column in 1 2 3 4; do
  name=(cold warm local swap)
  if [[ "$network" == "testnet" && "$column" == 4 ]]; then continue; fi
  median="$(awk -v c="$column" '{print $c}' "$out/samples" | sort -n | awk '{v[NR]=$1} END {print v[int((NR+1)/2)]}')"
  echo "$network ${name[$((column - 1))]} median ${median} ms over $runs runs"
done
