/**
 * Loading wallet manifests and executor bundles from NEAR contract state.
 *
 * Directive: `onchain:<contractId>:<method>`, e.g. `onchain:registry.near:get_code`.
 * Bundles: a view call `method({ wallet_id })` returning the raw bundle (gzip or plain).
 * Manifests: a view call `method()` returning JSON (a manifest or a signed envelope).
 *
 * Reads go through `call_function`, not `view_state`: RPC nodes may refuse `view_state` once
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

const isGzip = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

async function gunzip(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") throw new Error("gzip bundles need DecompressionStream");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/**
 * Loads an executor bundle with a single view call `method({ wallet_id })` that returns the raw bundle,
 * gzip (detected by its magic bytes) or plain. Integrity is checked by the caller against `manifest.sha256`.
 */
export async function loadOnchainCode(source: string, walletId: string, providers: Providers | undefined) {
  const { contractId, method, network } = parseOnchainSource(source);
  const bytes = await viewCall(rpcList(providers, network), contractId, method, { wallet_id: walletId });
  if (bytes.length === 0) throw new Error(`${contractId}.${method} returned no bundle for ${walletId}`);
  return isGzip(bytes) ? await gunzip(bytes) : new TextDecoder().decode(bytes);
}

export async function loadOnchainJson<T = unknown>(source: string, providers?: Providers): Promise<T> {
  const { contractId, method, network } = parseOnchainSource(source);
  const response = await viewCall(rpcList(providers, network), contractId, method);
  return JSON.parse(new TextDecoder().decode(response)) as T;
}
