#!/usr/bin/env node
/**
 * Manifest signing helpers for the on-chain registry (contracts/registry).
 *
 *   node build-scripts/registryManifest.js pubkey   <registry> [--path near-connect/manifest] [--mpc v1.signer] [--domain 1]
 *       Prints the ed25519 key MPC derives for the registry: pass it to `new`/`set_mpc_config`
 *       and pin it in `manifestPublicKeys`.
 *
 *   node build-scripts/registryManifest.js proposal <registry> <manifest.json> [--out proposal.json]
 *       Sputnik DAO `add_proposal` payload calling `set_manifest` (the registry then asks MPC to sign it).
 *
 *   node build-scripts/registryManifest.js export   <registry> <out.json>
 *       Saves `get_signed_manifest` as a file to mirror on a CDN (clients verify it the same way).
 */
const fs = require("fs");

const [cmd, registry, arg] = process.argv.slice(2);
const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
};
if (!cmd || !registry) {
  console.error("Usage: registryManifest.js pubkey|proposal|export <registry> [...]");
  process.exit(1);
}

const network = registry.endsWith(".testnet") ? "testnet" : "mainnet";
const rpc = opt("rpc", network === "testnet" ? "https://rpc.testnet.fastnear.com" : "https://rpc.mainnet.fastnear.com");

async function view(contract, method, args = {}) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.data ?? JSON.stringify(json.error));
  if (json.result.error) throw new Error(json.result.error);
  return JSON.parse(Buffer.from(json.result.result).toString());
}

(async () => {
  if (cmd === "pubkey") {
    const mpc = opt("mpc", network === "testnet" ? "v1.signer-prod.testnet" : "v1.signer");
    const path = opt("path", "near-connect/manifest");
    const domainId = Number(opt("domain", 1));
    const publicKey = await view(mpc, "derived_public_key", { path, predecessor: registry, domain_id: domainId });
    console.log(publicKey);
    console.error(`\nmpc config: ${JSON.stringify({ contract_id: mpc, path, domain_id: domainId, public_key: publicKey })}`);
    return;
  }

  if (cmd === "proposal") {
    if (!arg) throw new Error("Pass the manifest JSON file");
    const manifest = JSON.stringify(JSON.parse(fs.readFileSync(arg, "utf8"))); // canonical: what gets hashed and signed
    // Storage for the manifest (1 NEAR per 100 KB) with headroom + signature record; the surplus is refunded
    const depositYocto = BigInt(Math.ceil((manifest.length + 1000) / 100)) * 10n ** 21n + 1n;
    const proposal = {
      proposal: {
        description: `near-connect: set manifest (${manifest.length} bytes, sha256 ${require("crypto").createHash("sha256").update(manifest).digest("hex")})`,
        kind: {
          FunctionCall: {
            receiver_id: registry,
            actions: [{ method_name: "set_manifest", args: Buffer.from(JSON.stringify({ manifest })).toString("base64"), deposit: depositYocto.toString(), gas: "150000000000000" }],
          },
        },
      },
    };
    const out = opt("out", "proposal.json");
    fs.writeFileSync(out, JSON.stringify(proposal, null, 2));
    console.log(`Wrote ${out}. Voters: decode args, compare the manifest with the reviewed file, check the sha256 in the description.`);
    return;
  }

  if (cmd === "export") {
    if (!arg) throw new Error("Pass the output file");
    const signed = await view(registry, "get_signed_manifest");
    if (!signed.signature) throw new Error("Manifest is not signed yet (call request_manifest_signature if MPC timed out)");
    fs.writeFileSync(arg, JSON.stringify(signed));
    console.log(`Wrote ${arg}: sequence ${signed.signature.sequence}, key ${signed.signature.public_key}`);
    return;
  }

  throw new Error(`Unknown command ${cmd}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
