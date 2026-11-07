#!/usr/bin/env node
/**
 * Prepares a registry release (contracts/registry): one upload transaction per changed bundle, then one
 * DAO proposal `set_manifest` that publishes everything atomically.
 *
 *   node build-scripts/registryRelease.js --registry <contract> --signer <uploader> [options]
 *
 *   --manifest <file>    source manifest (default repository/manifest.json)
 *   --bundles <dir>      where executor files live, matched by URL basename (default repository)
 *   --wallets a,b        serve only these wallets on-chain (default: every wallet with a local bundle)
 *   --out <dir>          release manifest + proposal (default build/registry)
 *   --sign "<near-cli signing args>"   default "sign-with-legacy-keychain";
 *                        CI: "sign-with-plaintext-private-key <ed25519:...>" with a function-call key on upload_bundle
 *                        (near-cli output is captured and redacted, so the key does not reach the log)
 *   --dry                print upload commands instead of running them
 *
 * For each served wallet the release manifest gets `sha256` (of the plain code) and
 * `onchain:<registry>:get_code` as the first executor source; existing URLs stay as fallbacks.
 * Bundles already in the registry (by sha256) are not uploaded again.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};

const registry = opt("registry");
const signer = opt("signer");
if (!registry || !signer) {
  console.error("Usage: registryRelease.js --registry <contract> --signer <uploader> [--manifest f] [--bundles dir] [--wallets a,b] [--out dir] [--sign '...'] [--dry]");
  process.exit(1);
}

const network = registry.endsWith(".testnet") ? "testnet" : "mainnet";
const rpc = opt("rpc", `https://rpc.${network}.fastnear.com`);
const manifestPath = opt("manifest", "repository/manifest.json");
const bundlesDir = opt("bundles", "repository");
const outDir = path.resolve(opt("out", "build/registry"));
const only = opt("wallets") ? new Set(opt("wallets").split(",")) : null;
const sign = opt("sign", "sign-with-legacy-keychain").split(" ");
const dry = argv.includes("--dry");
const ONCHAIN = `onchain:${registry}:get_code`;
const MAX_BUNDLE = 1_500_000;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

async function view(method, args = {}) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: { request_type: "call_function", finality: "final", account_id: registry, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.data ?? JSON.stringify(json.error));
  if (json.result.error) throw new Error(json.result.error);
  return JSON.parse(Buffer.from(json.result.result).toString());
}

function localBundle(wallet) {
  const sources = (Array.isArray(wallet.executor) ? wallet.executor : [wallet.executor]).filter((s) => !s.startsWith("onchain:"));
  for (const source of sources) {
    const file = path.join(bundlesDir, path.basename(source.split("?")[0]));
    if (fs.existsSync(file)) return { file, sources };
  }
  return null;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const uploads = [];
  for (const wallet of manifest.wallets) {
    if (wallet.type !== "sandbox" || (only && !only.has(wallet.id))) continue;
    const local = localBundle(wallet);
    if (!local) {
      console.log(`- ${wallet.id}: no local bundle, left as is`);
      continue;
    }

    const code = fs.readFileSync(local.file);
    const hash = sha256(code);
    const gz = zlib.gzipSync(code, { level: 9 });
    if (gz.length > MAX_BUNDLE) throw new Error(`${wallet.id}: ${gz.length} bytes gzip does not fit one transaction`);

    wallet.sha256 = hash;
    wallet.executor = [ONCHAIN, ...local.sources];

    const known = await view("get_bundle_info", { sha256: hash });
    console.log(`- ${wallet.id}: ${code.length} B, gzip ${gz.length} B, sha256 ${hash.slice(0, 16)}… ${known ? "already uploaded" : "to upload"}`);
    if (known) continue;

    const payload = path.join(outDir, `${wallet.id}.${hash.slice(0, 12)}.bin`);
    fs.writeFileSync(payload, Buffer.concat([Buffer.from(hash, "hex"), gz])); // args: sha256(code) || gzip
    uploads.push(payload);
  }

  for (const payload of uploads) {
    const args = ["contract", "call-function", "as-transaction", registry, "upload_bundle", "file-args", payload, "prepaid-gas", "100.0 Tgas", "attached-deposit", "0 NEAR", "sign-as", signer, "network-config", network, ...sign, "send"];
    if (dry) {
      console.log(`near ${args.map((a) => (a.includes(" ") ? `'${a}'` : a)).join(" ")}`);
      continue;
    }
    // near-cli echoes the full command, private key included, so its output never goes to the (CI) log as is
    try {
      execFileSync("near", args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      const output = `${e.stdout ?? ""}${e.stderr ?? ""}`.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{80,}/g, "ed25519:<redacted>");
      throw new Error(`upload of ${path.basename(payload)} failed:\n${output.slice(-2000)}`);
    }
    console.log(`  uploaded ${path.basename(payload)}`);
  }

  // Canonical JSON: these exact bytes are hashed and signed by the registry
  const releaseManifest = JSON.stringify(manifest);
  fs.writeFileSync(path.join(outDir, "manifest.json"), releaseManifest);

  const proposal = {
    proposal: {
      description: `near-connect release: manifest sha256 ${sha256(releaseManifest)}, ${manifest.wallets.filter((w) => w.sha256).length} pinned wallets`,
      kind: {
        FunctionCall: {
          receiver_id: registry,
          actions: [{ method_name: "set_manifest", args: Buffer.from(JSON.stringify({ manifest: releaseManifest })).toString("base64"), deposit: "0", gas: "200000000000000" }],
        },
      },
    },
  };
  fs.writeFileSync(path.join(outDir, "proposal.json"), JSON.stringify(proposal, null, 2));
  console.log(`\nRelease manifest and DAO proposal: ${outDir}`);
  console.log(`Submit: near contract call-function as-transaction <dao> add_proposal file-args ${path.join(outDir, "proposal.json")} prepaid-gas '100.0 Tgas' attached-deposit '<bond>' ...`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
