# Oath Wallet connector

Oath is a native iOS wallet. Its selector entry uses NEAR Connect's existing
sandbox wallet card and opens WalletConnect's QR/mobile handoff modal directly.
The dApp must supply a WalletConnect client, as for the existing WalletConnect
entry. The icon and executor URLs in the manifest become available upstream
when this PR is merged; use local URLs when testing the branch.

## Supported scope

- Mainnet and testnet account discovery, connect, restore and disconnect.
- `signAndSendTransaction` and ordered `signAndSendTransactions` (1–16).
- Standard NEAR actions: CreateAccount, DeployContract, FunctionCall, Transfer,
  Stake, AddKey, DeleteKey, DeleteAccount, subject to Oath's explicit review,
  ownership, network, nonce, balance and payload checks.
- Borsh bytes use Oath's `{ type: "Buffer", data: number[] }` WalletConnect
  format. Signed bytes must match the original transaction and have a valid
  Ed25519 signature before any broadcast. A failed transaction stops the batch.
- No NEP-413, delegated actions, global contracts, gas keys or function-call-key
  sign-in is advertised. Function-call transactions themselves are supported.
  Sign-in does not add an access key; disconnect only closes this WC session.
- Restores only the topic saved by this connector. Fresh pairing is correlated
  to its pairing topic, not whichever session happened to connect last.

`getSession` accepts optional topic/pairingTopic filters; existing callers retain
last-session behavior. The sandbox exposes `supportsSessionFilters`; older SDKs
show an update-required error instead of reusing an unrelated session. The SDK
bridge changes need to ship alongside the manifest entry. The host consumes rejected approval promises to avoid an
unhandled rejection. The Oath UI has a five-minute pairing deadline and removes
its modal subscription on success, cancellation and error.

## Reproducible checks

```sh
cd near-wallets
yarn install --frozen-lockfile
yarn test:oath
yarn build:oath
cd ..
yarn type-check
```

Ten focused Node tests exercise real NEAR SDK serialization and cryptographic
signatures with disposable in-memory keys, mocked RPC/WC boundaries, transaction
mutation, malformed results, incomplete batches, wrong signer/network, unsafe
RPC nonces, exact large batch nonces, failure ordering, concurrency, session
restoration, and pairing cancellation/timeout.

The whole `near-wallets` type-check currently fails on the unchanged generic
`src/wallet-connect.ts:352` (number[] passed as number). Reproduced on unmodified
base 9cee11c04cfd42f5a420688f808d4aca612b5fde. The new connector's strict targeted
compilation and the root type-check pass. The production Oath executor builds.

## Live validation, 31 October 2026

The actual connector factory was run over the live WalletConnect relay with a
host executable built from Oath's current production Swift NEAR decoder,
reviewer, preflight and signer. A disposable testnet account was used. These
contract calls succeeded, with the exact aggregate wrapped-NEAR balance increase
of 6000000000000000000000 atomic units:

- Single: https://testnet.nearblocks.io/txns/B2fyE67JtiNnZbUvCbzMgCTg169yt9oFNGwMBykTM9rL
- Batch 1: https://testnet.nearblocks.io/txns/FuNg4FrXVbGLExzfQpg6mnLbuz8n3MzyHUmJPTK8nhuv
- Batch 2: https://testnet.nearblocks.io/txns/As4kNQhS8pieEGj9wjV4MzGmJg5Si9NbRdwJvHrFWCW7

Account discovery and disconnect passed. Oath's ten focused NEAR Swift host
tests passed separately. Browser checks with the actual local NEAR Connect
sandbox verified the Oath entry, real QR rendering, cancellation and reopening.

This is not a physical iPhone, App Store binary or mainnet transaction test.
Those are separate acceptance checks; no end-to-end iPhone claim is made here.

## Reviewer steps

1. Build the executor and point the Oath manifest's executor/icon to the local
   `repository/oath-wallet.js` and `repository/oath.svg` files in the example.
2. Supply a valid WalletConnect client; select testnet and Oath Wallet.
3. Scan the QR from Oath (or use its iOS handoff), review and approve the session.
4. With a disposable testnet account, review a contract call and then a batch.
5. Cancel pairing, retry, disconnect, and verify stale/other sessions are not
   used. Mainnet must use mainnet RPC and session accounts; do not spend real
   funds merely to review this PR.

App: https://apps.apple.com/app/id6780187283
Source: https://github.com/devdasx/oath-wallet/blob/main/Packages/OathAnkr/Sources/OathAnkr/WalletConnectNear.swift
