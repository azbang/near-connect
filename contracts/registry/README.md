# near-connect-registry

On-chain registry for NEAR Connect: the wallet manifest (signed by NEAR MPC) and executor bundles, governed by a Sputnik DAO.

## Model

- **The manifest is the release.** Each wallet entry carries `sha256` of its code. `set_manifest` (DAO only):
  - indexes `wallet_id -> sha256` for wallets whose `executor` includes `onchain:<registry>:get_code`;
  - requires their bundles to be uploaded;
  - deletes bundles the previous manifest used and the new one does not;
  - bumps `sequence` and asks MPC to sign `"near-connect:manifest:v1:" || sequence (u64 BE) || sha256(manifest)` on the ed25519 domain. The callback verifies the signature and stores it.

  One proposal, one action, atomic. The payload comes from on-chain state, so the DAO never signs blind bytes.
- **Bundles are uploaded in one transaction each.** `upload_bundle` raw args are `sha256(code) || bytes` (gzip or plain, up to 1.5 MB). Only allow-listed uploaders may call it. It is not payable, so a CI bot can use a function-call key limited to `upload_bundle`. The contract cannot un-gzip, so the claimed hash is checked by clients against the signed manifest; a bad upload only makes that source fail.
- **The registry pays for storage** from its own balance (fund it once). Replaced bundles are deleted on `set_manifest`, which unlocks their storage. Uploads that were never published count towards `max_pending_bytes` (default 5 MB) and can be pruned by anyone after `pending_ttl_ns` (default 14 days), or by the uploader or owner at any time.
- **Reads are view calls** (`get_code`, `get_signed_manifest`). RPC nodes may refuse `view_state` for accounts over 50 KB.
- **No upgrade method.** Upgrade the account with a full access key, e.g. an MPC key derived for the DAO.

## Client

```ts
new NearConnector({
  manifest: ["onchain:registry.near:get_signed_manifest", "https://cdn.example/manifest.signed.json"],
  manifestPublicKeys: ["ed25519:<derived key>"],
});
```

Wallet entries: `"executor": ["onchain:registry.near:get_code", "<cdn url>"]` plus `"sha256"`. With `manifestPublicKeys` set, sandbox wallets without `sha256` are skipped.

## Build and test

```bash
cargo test
cargo near build non-reproducible-wasm
```

## Deploy and release

```bash
# Key MPC derives for the registry account (pin it in manifestPublicKeys)
node build-scripts/registryManifest.js pubkey <registry>

near contract deploy <registry> use-file target/near/near_connect_registry.wasm \
  with-init-call new json-args '{"owner_id":"<dao>","uploaders":["<bot>"],"mpc":{"contract_id":"v1.signer","path":"near-connect/manifest","domain_id":1,"public_key":"ed25519:..."}}' ...

# Bot: function-call key that can only upload
near account add-key <bot> grant-function-call-access --allowance '1 NEAR' --contract-account-id <registry> --function-names upload_bundle ...

# Release: pins sha256, uploads missing bundles, writes the set_manifest DAO proposal
node build-scripts/registryRelease.js --registry <registry> --signer <bot> --sign "sign-with-plaintext-private-key $BOT_KEY"
near contract call-function as-transaction <dao> add_proposal file-args build/registry/proposal.json prepaid-gas '100.0 Tgas' attached-deposit '<bond>' ...

# Lock the DAO down: only the council and the release bot add proposals, the bot only FunctionCall ones, bond 0
node build-scripts/registryManifest.js policy <dao> <bot> --out policy-proposals.json
near account add-key <bot> grant-function-call-access --allowance '0.5 NEAR' --contract-account-id <dao> --function-names add_proposal ...

# Mirror the signed manifest to a CDN
node build-scripts/registryManifest.js export <registry> manifest.signed.json
```

## Who can do what

| Action | Who | Enforced by |
|---|---|---|
| `upload_bundle` | accounts in `uploaders` (set by the DAO) | registry |
| `add_proposal` | council + `release-bot` role (`call:AddProposal` only, so no Transfer or ChangePolicy) | Sputnik policy |
| `set_manifest`, `set_uploaders`, `set_limits`, `set_mpc_config`, `set_owner` | the DAO, after a vote | registry |

With bond 0 the bot runs on two function-call keys and holds no full access key: one for `upload_bundle` on the registry, one for `add_proposal` on the DAO. A stolen key can upload junk (bounded by `max_pending_bytes`, rejected by clients via `sha256`) or open a proposal that still needs votes. It cannot move NEAR: the key allowance covers gas only.

Sputnik permissions are per proposal kind, not per receiver or method, so the bot's FunctionCall proposals can target any contract; voters still check them.

MPC signers: `v1.signer` (mainnet), `v1.signer-prod.testnet` (testnet). If a signature times out, anyone can call `request_manifest_signature`.
