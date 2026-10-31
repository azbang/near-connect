import { transactions, utils } from "near-api-js";
import { sha256 } from "@noble/hashes/sha256";
import { connectorActionsToNearApiJsActions, type ConnectorAction } from "../utils/action";
import type { Network, SignInParams } from "../utils/types";

export const OATH_METHODS = ["near_getAccounts", "near_signTransaction", "near_signTransactions"];
export interface Session {
  topic: string;
  pairingTopic?: string;
  namespaces: Record<string, { accounts: string[]; methods: string[] }>;
}
export interface Account { accountId: string; publicKey: string }
export interface Bridge {
  getSession(params: { topic: string }): Promise<Session | null>;
  request(params: { topic: string; chainId: string; request: { method: string; params: unknown } }): Promise<unknown>;
  disconnect(params: { topic: string; reason: { code: number; message: string } }): Promise<unknown>;
}
export interface Dependencies {
  bridge: Bridge;
  pair(network: Network): Promise<Session>;
  storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
  rpc(network: Network): { query(params: unknown): Promise<any>; sendJsonRpc(method: string, params: unknown): Promise<any> };
}
export interface TransactionInput { signerId?: string; receiverId: string; actions: ConnectorAction[] }

export function assertNetwork(network: string): asserts network is Network {
  if (network !== "mainnet" && network !== "testnet") throw new Error("Unsupported NEAR network");
}
export function sessionAccounts(session: Session, network: Network): string[] {
  const ns = session.namespaces.near ?? session.namespaces[`near:${network}`];
  if (!ns || !OATH_METHODS.every(method => ns.methods.includes(method))) return [];
  return ns.accounts.filter(account => account.startsWith(`near:${network}:`)).map(account => account.slice(`near:${network}:`.length));
}
export function buffer(bytes: Uint8Array) { return { type: "Buffer", data: Array.from(bytes) }; }
export function decodeBuffer(value: unknown): Uint8Array {
  const v = value as { type?: string; data?: unknown[] } | null;
  if (!v || v.type !== "Buffer" || !Array.isArray(v.data) || v.data.length < 1 || v.data.length > 131_137 ||
      !v.data.every(n => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 255)) throw new Error("Invalid Oath signed transaction");
  return Uint8Array.from(v.data as number[]);
}

export function createOathWallet(deps: Dependencies) {
  // Serialize signing operations so two calls cannot allocate the same nonce.
  let busy = false;
  const exclusive = async <T>(run: () => Promise<T>): Promise<T> => {
    if (busy) throw new Error("An Oath request is already pending");
    busy = true;
    try { return await run(); } finally { busy = false; }
  };
  const storageKey = (network: Network) => `session:${network}`;
  async function session(network: Network): Promise<Session | null> {
    assertNetwork(network);
    const topic = await deps.storage.get(storageKey(network));
    if (!topic) return null;
    const value = await deps.bridge.getSession({ topic });
    if (!value || value.topic !== topic || !sessionAccounts(value, network).length) return null;
    return value;
  }
  async function request(current: Session, network: Network, method: string, params: unknown) {
    return deps.bridge.request({ topic: current.topic, chainId: `near:${network}`, request: { method, params } });
  }
  async function accounts(current: Session, network: Network): Promise<Account[]> {
    const result = await request(current, network, "near_getAccounts", {});
    const approved = sessionAccounts(current, network);
    if (!Array.isArray(result) || !result.length || result.length > 16) throw new Error("Oath returned no accounts");
    return result.map((account: Account) => {
      if (!account || !approved.includes(account.accountId) || typeof account.publicKey !== "string" || !account.publicKey.startsWith("ed25519:"))
        throw new Error("Oath account is not approved for this network");
      utils.PublicKey.from(account.publicKey);
      return { accountId: account.accountId, publicKey: account.publicKey };
    });
  }
  async function signAndSend(inputs: TransactionInput[], network: Network, batch: boolean, signerId?: string) {
    assertNetwork(network);
    if (!inputs.length || inputs.length > 16) throw new Error("Oath supports batches of 1–16 transactions");
    const current = await session(network);
    if (!current) throw new Error("Connect Oath Wallet first");
    const available = await accounts(current, network);
    const signer = signerId ?? inputs[0].signerId ?? available[0].accountId;
    const account = available.find(x => x.accountId === signer);
    if (!account || inputs.some(x => x.signerId && x.signerId !== signer)) throw new Error("Invalid signer id");
    const rpc = deps.rpc(network);
    const accessKey = await rpc.query({ request_type: "view_access_key", finality: "final", account_id: signer, public_key: account.publicKey });
    // Never silently round a nonce received through JSON.
    if (!Number.isSafeInteger(accessKey.nonce) || accessKey.nonce < 0 || accessKey.permission !== "FullAccess") throw new Error("Invalid full-access key or nonce");
    const publicKey = utils.PublicKey.from(account.publicKey);
    const blockHash = utils.serialize.base_decode(accessKey.block_hash);
    if (blockHash.length !== 32) throw new Error("Invalid NEAR block hash");
    const unsigned = inputs.map((input, i) => {
      if (!input.actions.length || input.actions.length > 100) throw new Error("Invalid NEAR action count");
      // Unsupported protocol extensions fail here instead of becoming another action.
      const actions = connectorActionsToNearApiJsActions(input.actions);
      return transactions.createTransaction(signer, publicKey, input.receiverId, BigInt(accessKey.nonce) + BigInt(i + 1), actions, blockHash).encode();
    });
    if (unsigned.reduce((size, bytes) => size + bytes.length, 0) > 131_072) throw new Error("Oath transaction payload is too large");
    const result = await request(current, network, batch ? "near_signTransactions" : "near_signTransaction",
      batch ? { transactions: unsigned.map(buffer) } : { transaction: buffer(unsigned[0]) });
    const responses = batch ? result : [result];
    if (!Array.isArray(responses) || responses.length !== unsigned.length) throw new Error("Oath returned an incomplete transaction batch");
    // Validate every signed transaction before broadcasting any of the batch.
    const signed = responses.map((response, i) => {
      const bytes = decodeBuffer(response);
      const decoded = transactions.SignedTransaction.decode(bytes);
      const original = unsigned[i];
      const actual = transactions.encodeTransaction(decoded.transaction);
      if (actual.length !== original.length || !actual.every((byte, j) => byte === original[j]) || bytes.length !== original.length + 65 ||
          bytes[original.length] !== 0 || !publicKey.verify(sha256(original), bytes.slice(-64))) throw new Error("Oath signature or transaction does not match the request");
      return Buffer.from(bytes).toString("base64");
    });
    const outcomes = [];
    for (const bytes of signed) {
      // No automatic rebroadcast on ambiguous transport errors. Preserve ordering.
      const outcome = await rpc.sendJsonRpc("broadcast_tx_commit", [bytes]);
      if (typeof outcome?.status !== "object" || outcome.status === null || !("SuccessValue" in outcome.status))
        throw new Error("NEAR transaction did not succeed; later transactions were not submitted");
      outcomes.push(outcome);
    }
    return outcomes;
  }
  return {
    signIn: ({ network, addFunctionCallKey }: SignInParams) => exclusive(async () => {
      assertNetwork(network);
      // Explicitly unsupported: do not silently discard a requested permission.
      if (addFunctionCallKey) throw new Error("Oath connector does not support sign-in with a function-call key");
      let current = await session(network);
      if (!current) {
        current = await deps.pair(network);
        if (!sessionAccounts(current, network).length) throw new Error("Oath session does not support this network");
        await deps.storage.set(storageKey(network), current.topic);
      }
      return accounts(current, network);
    }),
    async getAccounts({ network }: { network: Network }) {
      const current = await session(network);
      return current ? accounts(current, network) : [];
    },
    signOut: ({ network }: { network: Network }) => exclusive(async () => {
      const current = await session(network);
      if (current) await deps.bridge.disconnect({ topic: current.topic, reason: { code: 6000, message: "User disconnected Oath" } });
      await deps.storage.remove(storageKey(network));
    }),
    signAndSendTransaction: (input: TransactionInput & { network: Network }) => exclusive(async () =>
      (await signAndSend([input], input.network, false, input.signerId))[0]),
    signAndSendTransactions: (input: { transactions: TransactionInput[]; network: Network; signerId?: string }) => exclusive(() =>
      signAndSend(input.transactions, input.network, true, input.signerId)),
  };
}
