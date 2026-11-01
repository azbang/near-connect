#!/usr/bin/env node
/**
 * Prepares an executor bundle for the on-chain registry (contracts/registry).
 *
 *   node build-scripts/registryPrepare.js <bundle.js> --wallet <id> --registry <contract> --dao <dao> [--version 1.0.4] [--out dir] [--chunk 512000] [--signer acc] [--network mainnet]
 *
 * Writes gzip chunks, prints near-cli-rs commands to upload them (anyone can upload: chunks are content-addressed)
 * and a Sputnik DAO `add_proposal` payload that calls `publish` on the registry.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};

const file = args[0];
const walletId = opt("wallet");
const registry = opt("registry");
const dao = opt("dao");
if (!file || file.startsWith("--") || !walletId || !registry || !dao) {
  console.error("Usage: registryPrepare.js <bundle.js> --wallet <id> --registry <contract> --dao <dao> [--version x] [--out dir] [--chunk bytes] [--signer acc] [--network mainnet]");
  process.exit(1);
}

const version = opt("version", "0.0.0");
const network = opt("network", registry.endsWith(".testnet") ? "testnet" : "mainnet");
const signer = opt("signer", "<your-account>");
const chunkSize = Number(opt("chunk", 512_000));
const outDir = path.resolve(opt("out", path.join("build", "registry", walletId)));
if (!(chunkSize > 0 && chunkSize <= 1_000_000)) throw new Error("--chunk must be in (0, 1000000]");

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const code = fs.readFileSync(file);
const gz = zlib.gzipSync(code, { level: 9 });

fs.mkdirSync(outDir, { recursive: true });
const chunks = [];
for (let offset = 0; offset < gz.length; offset += chunkSize) {
  const chunk = gz.subarray(offset, offset + chunkSize);
  const hash = sha256(chunk);
  const chunkPath = path.join(outDir, `${chunks.length}-${hash.slice(0, 12)}.bin`);
  fs.writeFileSync(chunkPath, chunk);
  chunks.push({ hash, path: chunkPath, size: chunk.length });
}

// Storage: 1 NEAR per 100 KB (1e19 yocto per byte) plus record overhead, rounded up; the surplus is refunded
const depositFor = (bytes) => Math.ceil(((bytes + 400) * 1e19) / 1e21) / 1e3; // NEAR, 3 decimals

const bundle = { version, sha256: sha256(code), encoding: "gzip", size: gz.length, chunks: chunks.map((c) => c.hash) };
const publishArgs = { wallet_id: walletId, bundle };
const proposal = {
  proposal: {
    description: `near-connect: publish ${walletId} ${version}, code sha256 ${bundle.sha256}`,
    kind: {
      FunctionCall: {
        receiver_id: registry,
        actions: [
          {
            method_name: "publish",
            args: Buffer.from(JSON.stringify(publishArgs)).toString("base64"),
            deposit: (BigInt(Math.round(depositFor(200 + 70 * chunks.length) * 1e3)) * 10n ** 21n).toString(),
            gas: "100000000000000",
          },
        ],
      },
    },
  },
};

fs.writeFileSync(path.join(outDir, "bundle.json"), JSON.stringify(bundle, null, 2));
fs.writeFileSync(path.join(outDir, "proposal.json"), JSON.stringify(proposal, null, 2));

console.log(`Code:    ${code.length} bytes, sha256 ${bundle.sha256}`);
console.log(`Gzip:    ${gz.length} bytes in ${chunks.length} chunk(s) -> ${outDir}\n`);
console.log("1) Upload chunks (any account):");
for (const c of chunks) {
  console.log(
    `near contract call-function as-transaction ${registry} upload_chunk file-args ${c.path} prepaid-gas '150.0 Tgas' attached-deposit '${depositFor(c.size)} NEAR' sign-as ${signer} network-config ${network} sign-with-keychain send`
  );
}
console.log(`\n2) Create the DAO proposal (attach the DAO proposal bond):`);
console.log(
  `near contract call-function as-transaction ${dao} add_proposal file-args ${path.join(outDir, "proposal.json")} prepaid-gas '100.0 Tgas' attached-deposit '0.1 NEAR' sign-as ${signer} network-config ${network} sign-with-keychain send`
);
console.log(`\nVoters: check that sha256 of the bundle file equals ${bundle.sha256} and that the decoded args match bundle.json.`);
console.log(`\nManifest entry:\n  "executor": ["onchain:${registry}:get_bundle", "<cdn fallback url>"],\n  "sha256": "${bundle.sha256}"`);
