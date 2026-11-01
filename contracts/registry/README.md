# near-connect-registry

On-chain registry for NEAR Connect: the wallet manifest and executor bundles, governed by a Sputnik DAO, with the manifest signed by NEAR MPC (chain signatures).

## Model

- **Bundles**: content-addressed chunks. Anyone can `upload_chunk` (raw bytes as args, pays storage); the key is `sha256(chunk)`. The owner (DAO) runs `publish(wallet_id, { version, sha256, encoding, size, chunks })`.
- **Manifest**: the owner runs `set_manifest(manifest)`. The contract bumps `sequence` and calls MPC `sign` with
  `"near-connect:manifest:v1:" || sequence (u64 BE) || sha256(manifest)` on the ed25519 domain. The callback verifies the
  signature against the configured key and stores it. The payload comes from on-chain state, so the DAO never signs blind bytes.
- **Reads**: view calls only (`get_signed_manifest`, `get_bundle`, `get_chunk`). RPC nodes may refuse `view_state` for accounts over 50 KB.
- **No upgrade method**. Upgrade the account with a full access key, e.g. an MPC key derived for the DAO.

## Client

```ts
new NearConnector({
  manifest: ["onchain:registry.near:get_signed_manifest", "https://cdn.example/manifest.signed.json"],
  manifestPublicKeys: ["ed25519:<derived key>"],
});
```

Wallet entries can then use `"executor": ["onchain:registry.near:get_bundle", "<cdn url>"]` and an optional `"sha256"`.

## Build and test

```bash
cargo test
cargo near build non-reproducible-wasm
```

## Deploy

```bash
# Key MPC derives for the registry account (pin it in manifestPublicKeys)
node build-scripts/registryManifest.js pubkey <registry>

near contract deploy <registry> use-file target/near/near_connect_registry.wasm \
  with-init-call new json-args '{"owner_id":"<dao>","mpc":{"contract_id":"v1.signer","path":"near-connect/manifest","domain_id":1,"public_key":"ed25519:..."}}' ...

# DAO proposal for set_manifest (attach ~150 Tgas; the surplus deposit is refunded)
node build-scripts/registryManifest.js proposal <registry> repository/manifest.json --out proposal.json

# Bundle chunks + publish proposal
node build-scripts/registryPrepare.js repository/hotwallet.js --wallet hot-wallet --registry <registry> --dao <dao>

# Mirror the signed manifest to a CDN
node build-scripts/registryManifest.js export <registry> manifest.signed.json
```

MPC signers: `v1.signer` (mainnet), `v1.signer-prod.testnet` (testnet). If a signature times out, anyone can call `request_manifest_signature` (1 yoctoNEAR).
