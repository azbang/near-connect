#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
corepack yarn type-check
corepack yarn tsc --noEmit false --outDir "$out" --rootDir . --module commonjs --target ESNext --strict --skipLibCheck --esModuleInterop --resolveJsonModule test/screen.ts
if [[ -z "${SCREEN_TEST_CONTRACT:-}" && -f .progress/screen-test-contract ]]; then
  export SCREEN_TEST_CONTRACT="$(cat .progress/screen-test-contract)"
fi
if [[ -z "${SCREEN_TEST_CONTRACT:-}" ]]; then
  echo "SCREEN_TEST_CONTRACT is missing; run scripts/screen-live.sh first" >&2
  exit 2
fi
node "$out/test/screen.js"
