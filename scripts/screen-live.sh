#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rpc="https://near-testnet.drpc.org"
contract="${SCREEN_TEST_CONTRACT:-}"
wasm="${SCREEN_TEST_WASM:-}"
if [[ -z "$wasm" && -f .progress/screen-test-wasm ]]; then wasm="$(cat .progress/screen-test-wasm)"; fi
if [[ -z "$wasm" ]]; then wasm="test/screen-contract/target/wasm32-unknown-unknown/release/screen_test_contract.wasm"; fi
if [[ ! -f "$wasm" ]]; then
  echo "Set SCREEN_TEST_WASM to a NEAR WebAssembly contract built from test/screen-contract" >&2
  exit 2
fi
if [[ -z "$contract" && -f .progress/screen-test-contract ]]; then contract="$(cat .progress/screen-test-contract)"; fi
if [[ -z "$contract" ]]; then contract="screen-contract-$(date -u +%Y%m%d).testnet"; fi

rpc_call() {
  curl -fsS "$rpc" -H 'content-type: application/json' --data "$1"
}
account_exists="$(rpc_call "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$contract\"}}" 2>/dev/null | node -e 'let d="";process.stdin.on("data",x=>d+=x).on("end",()=>{try{process.stdout.write(JSON.parse(d).result?"1":"0")}catch{process.stdout.write("0")}})' || true)"
if [[ "$account_exists" != "1" ]]; then
  if ! create_output="$(near account create-account sponsor-by-faucet-service "$contract" autogenerate-new-keypair save-to-legacy-keychain network-config testnet create 2>&1)"; then
    credentials="$HOME/.near-credentials/testnet/$contract.json"
    key="$(jq -r '.public_key // empty' "$credentials" 2>/dev/null || true)"
    if [[ -z "$key" ]]; then echo "Testnet faucet account creation failed" >&2; exit 1; fi
    gh workflow run create-testnet-account.yml -R CryptoInnovators/near-sworn -f account_id="$contract" -f public_key="$key" >/dev/null
    unset key
    run_id="$(gh run list -R CryptoInnovators/near-sworn --workflow create-testnet-account.yml --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId')"
    gh run watch "$run_id" -R CryptoInnovators/near-sworn --exit-status >/dev/null
  fi
  unset create_output
fi

hash="$(rpc_call "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_code\",\"finality\":\"final\",\"account_id\":\"$contract\"}}" 2>/dev/null | node -e 'let d="";process.stdin.on("data",x=>d+=x).on("end",()=>{try{process.stdout.write(JSON.parse(d).result?.hash||"")}catch{}})' || true)"
tx=""
if [[ -z "$hash" ]]; then
  if ! deploy_output="$(near contract deploy "$contract" use-file "$wasm" without-init-call network-config testnet-drpc sign-with-keychain send 2>&1)"; then
    unset deploy_output
    echo "Testnet contract deployment failed" >&2
    exit 1
  fi
  tx="$(printf '%s\n' "$deploy_output" | sed -nE 's/.*Transaction ID: ([1-9A-HJ-NP-Za-km-z]{40,})/\1/p' | tail -1)"
  unset deploy_output
  hash="$(rpc_call "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_code\",\"finality\":\"final\",\"account_id\":\"$contract\"}}" | node -e 'let d="";process.stdin.on("data",x=>d+=x).on("end",()=>{try{process.stdout.write(JSON.parse(d).result?.hash||"")}catch{}})')"
fi
if [[ -z "$hash" ]]; then echo "Contract code was not verifiable on testnet" >&2; exit 1; fi
mkdir -p .progress
printf '%s\n' "$contract" > .progress/screen-test-contract
printf '%s\n' "$wasm" > .progress/screen-test-wasm
if [[ -n "$tx" ]]; then printf '%s\n' "$tx" > .progress/screen-test-deploy-tx; fi
if [[ -n "$tx" ]]; then echo "DEPLOYED $contract $tx $hash"; elif [[ -f .progress/screen-test-deploy-tx ]]; then echo "REUSED $contract $(cat .progress/screen-test-deploy-tx) $hash"; else echo "REUSED $contract $hash"; fi
if [[ "${SCREEN_LIVE_SETUP_ONLY:-}" == "1" ]]; then exit 0; fi
SCREEN_TEST_CONTRACT="$contract" bash scripts/screen-test.sh
