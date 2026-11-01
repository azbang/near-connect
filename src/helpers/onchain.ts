/**
 * Loading wallet manifests and executor bundles from NEAR contract state.
 *
 * Directive: `onchain:<contractId>:<method>`, e.g. `onchain:registry.near:get_bundle`.
 * The method is a view call made with `{ "wallet_id": <manifest id> }` (no args for the manifest).
 * It may return either:
 *  - the raw code (or raw manifest JSON) — used as is;
 *  - a bundle descriptor `{ sha256, encoding, chunks }` — chunks are fetched from the same contract
 *    with `get_chunk({ hash })`, checked against their hashes, joined and decoded.
 *
 * Reads go through `call_function`, not `view_state`: RPC nodes refuse `view_state` once
 * the account's state is larger than 50 KB, which any account holding bundles will be.
 * The dApp's own `providers` are tried first, so no extra CSP `connect-src` entries are needed.
 */

export type Network = "mainnet" | "testnet";
export type Providers = { mainnet?: string[]; testnet?: string[] };

export interface OnchainSource {
  contractId: string;
  method: string;
  network: Network;
}

export interface OnchainBundle {
  sha256: string;
  encoding?: "identity" | "gzip";
  chunks: string[];
  version?: string;
  size?: number;
}

const DEFAULT_RPC: Record<Network, string[]> = {
  mainnet: ["https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"],
  testnet: ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"],
};

const ONCHAIN_PREFIX = "onchain:";
const ACCOUNT_ID_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const METHOD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isOnchainSource = (source: string) => source.startsWith(ONCHAIN_PREFIX);

export function parseOnchainSource(source: string): OnchainSource {
  const [contractId, method, ...rest] = source.slice(ONCHAIN_PREFIX.length).split(":");
  if (!contractId || !method || rest.length > 0) throw new Error(`Invalid onchain source "${source}", expected onchain:<contractId>:<method>`);
  if (!ACCOUNT_ID_RE.test(contractId) || contractId.length < 2 || contractId.length > 64) throw new Error(`Invalid contract id in "${source}"`);
  if (!METHOD_RE.test(method)) throw new Error(`Invalid method name in "${source}"`);
  const network: Network = contractId.endsWith(".testnet") ? "testnet" : "mainnet";
  return { contractId, method, network };
}

/** dApp providers first (they are already allowed by its CSP), then public defaults. */
export function rpcList(providers: Providers | undefined, network: Network) {
  const own = providers?.[network] ?? [];
  return [...new Set([...own, ...DEFAULT_RPC[network]])];
}

export async function viewCall(rpcs: string[], contractId: string, method: string, args: object = {}): Promise<Uint8Array> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "near-connect",
    method: "query",
    params: { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
  });

  let lastError: unknown = new Error("No RPC endpoints");
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error(`RPC ${rpc} responded ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`RPC ${rpc}: ${json.error.data ?? json.error.message ?? JSON.stringify(json.error)}`);
      if (json.result?.error) throw new Error(`${contractId}.${method}: ${json.result.error}`);
      if (!Array.isArray(json.result?.result)) throw new Error(`RPC ${rpc}: unexpected response`);
      return Uint8Array.from(json.result.result as number[]);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("sha256 validation needs WebCrypto (a secure context: https or localhost)");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const normalizeHash = (hash: string) => hash.trim().toLowerCase();

async function decode(bytes: Uint8Array, encoding: OnchainBundle["encoding"]): Promise<string> {
  if (!encoding || encoding === "identity") return new TextDecoder().decode(bytes);
  if (encoding !== "gzip") throw new Error(`Unsupported bundle encoding "${encoding}"`);
  if (typeof DecompressionStream === "undefined") throw new Error("gzip bundles need DecompressionStream");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function parseBundle(bytes: Uint8Array): OnchainBundle | null {
  // A descriptor is small JSON; anything else is raw code
  if (bytes.length > 64 * 1024 || bytes[0] !== 0x7b /* { */) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof json?.sha256 === "string" && Array.isArray(json.chunks)) return json as OnchainBundle;
  } catch {}
  return null;
}

/**
 * Loads an executor bundle.
 * `knownSha256` is the hash of the code the caller already has (cache): when the descriptor
 * points to the same hash the chunks are not downloaded and `null` is returned.
 */
export async function loadOnchainCode(source: string, walletId: string, providers: Providers | undefined, knownSha256?: string | null) {
  const { contractId, method, network } = parseOnchainSource(source);
  const rpcs = rpcList(providers, network);
  const response = await viewCall(rpcs, contractId, method, { wallet_id: walletId });

  const bundle = parseBundle(response);
  if (!bundle) {
    const code = new TextDecoder().decode(response);
    if (code.trim() === "" || code.trim() === "null") throw new Error(`${contractId}.${method} has no bundle for ${walletId}`);
    return code;
  }

  const expected = normalizeHash(bundle.sha256);
  if (knownSha256 && normalizeHash(knownSha256) === expected) return null;

  // Do not trust the RPC: every chunk must hash to the key it was requested by
  const chunks = await Promise.all(
    bundle.chunks.map(async (hash) => {
      const data = await viewCall(rpcs, contractId, "get_chunk", { hash });
      if ((await sha256Hex(data)) !== normalizeHash(hash)) throw new Error(`Chunk ${hash} from ${contractId} is corrupted`);
      return data;
    })
  );

  const joined = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  chunks.reduce((offset, c) => (joined.set(c, offset), offset + c.length), 0);

  const code = await decode(joined, bundle.encoding);
  if ((await sha256Hex(code)) !== expected) throw new Error(`Bundle from ${contractId} does not match its sha256`);
  return code;
}

export async function loadOnchainJson<T = unknown>(source: string, providers?: Providers): Promise<T> {
  const { contractId, method, network } = parseOnchainSource(source);
  const response = await viewCall(rpcList(providers, network), contractId, method);
  return JSON.parse(new TextDecoder().decode(response)) as T;
}
