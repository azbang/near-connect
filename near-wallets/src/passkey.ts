import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58, base64, base64url, hex } from "@scure/base";
import { KeyPair, PublicKey } from "@near-js/crypto";
import type { FinalExecutionOutcome } from "@near-js/types";
import { baseDecode } from "@near-js/utils";

import { NearRpc } from "./utils/rpc";
import type { ConnectorAction } from "./utils/action";
import type {
  SignInParams,
  SignInAndSignMessageParams,
  AccountWithSignedMessage,
  AddFunctionCallKeyParams,
  SignedMessage,
  Network,
} from "./utils/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const WALLET_DOMAIN = new TextEncoder().encode("NEAR_WALLET_CONTRACT/V1");
const WALLET_CONTRACT_ACCOUNT_ID = "0sa8247564c6774a33b975a053fc4fbebbd869772d";
const DEFAULT_TIMEOUT_SECS = 60 * 60; // 1 hour
const DEFAULT_WALLET_ID = 0;

// Sponsor account for relaying transactions
const RELAYER_ACCOUNT_ID = "a.frol.near";
const RELAYER_PRIVATE_KEY =
  "ed25519:3LG8RNaFqSAQZBvGzxra6zxHwTzi8pAucbCgyUkwGX3Fvfzhry8UTs29T7bBA8yhLVnSYhfdZ6wq4nsUz9s8fQFm";

const STORAGE_KEY_CREDENTIAL_ID = "passkey:credentialId";
const STORAGE_KEY_PUBLIC_KEY = "passkey:publicKey";
const STORAGE_KEY_ACCOUNT_ID = "passkey:accountId";

// ─── Borsh Serialization ─────────────────────────────────────────────────────

class BorshWriter {
  private buf: number[] = [];

  writeU8(value: number): void {
    this.buf.push(value & 0xff);
  }

  writeBool(value: boolean): void {
    this.writeU8(value ? 1 : 0);
  }

  writeU32(value: number): void {
    this.buf.push(
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    );
  }

  writeU64(value: bigint): void {
    let v = value;
    for (let i = 0; i < 8; i++) {
      this.buf.push(Number(v & 0xffn));
      v >>= 8n;
    }
  }

  writeU128(value: bigint): void {
    let v = value;
    for (let i = 0; i < 16; i++) {
      this.buf.push(Number(v & 0xffn));
      v >>= 8n;
    }
  }

  writeString(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.writeU32(bytes.length);
    for (const b of bytes) this.buf.push(b);
  }

  writeBytes(value: Uint8Array | number[]): void {
    this.writeU32(value.length);
    for (const b of value) this.buf.push(b);
  }

  writeOption<T>(value: T | undefined | null, write: (val: T) => void): void {
    if (value == null) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      write(value);
    }
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

// ─── Wallet-Contract Types ───────────────────────────────────────────────────

interface WalletRequestMessage {
  chain_id: string;
  signer_id: string;
  nonce: number;
  created_at: string;
  timeout_secs: number;
  request: WalletRequest;
}

interface WalletRequest {
  ops: WalletOp[];
  out: PromiseDag;
}

type WalletOp =
  | { op: "set_signature_mode"; enable: boolean }
  | { op: "add_extension"; account_id: string }
  | { op: "remove_extension"; account_id: string };

interface PromiseDag {
  after: PromiseDag[];
  then: PromiseSingle[];
}

interface PromiseSingle {
  receiver_id: string;
  refund_to?: string;
  actions: PromiseAction[];
}

type PromiseAction =
  | { action: "function_call"; function_name: string; args: string; deposit: string; min_gas?: string; gas_weight?: string }
  | { action: "transfer"; amount: string }
  | { action: "state_init"; state_init: StateInitJSON; deposit: string };

interface StateInitJSON {
  V1: {
    code: { account_id: string } | { hash: number[] };
    data: Map<number[], number[]>;
  };
}

// ─── Borsh Serialization Functions ───────────────────────────────────────────

function serializeRequestMessage(msg: WalletRequestMessage): Uint8Array {
  const w = new BorshWriter();
  w.writeString(msg.chain_id);
  w.writeString(msg.signer_id);
  w.writeU32(msg.nonce);
  w.writeU32(Math.floor(new Date(msg.created_at).getTime() / 1000));
  w.writeU32(msg.timeout_secs);
  writeRequest(w, msg.request);
  return w.toBytes();
}

function writeRequest(w: BorshWriter, req: WalletRequest): void {
  w.writeU32(req.ops.length);
  for (const op of req.ops) writeWalletOp(w, op);
  writePromiseDag(w, req.out);
}

function writePromiseDag(w: BorshWriter, dag: PromiseDag): void {
  w.writeU32(dag.after.length);
  for (const sub of dag.after) writePromiseDag(w, sub);
  w.writeU32(dag.then.length);
  for (const single of dag.then) writePromiseSingle(w, single);
}

function writePromiseSingle(w: BorshWriter, ps: PromiseSingle): void {
  w.writeString(ps.receiver_id);
  w.writeOption(ps.refund_to, (v) => w.writeString(v));
  w.writeU32(ps.actions.length);
  for (const action of ps.actions) writePromiseAction(w, action);
}

function writePromiseAction(w: BorshWriter, action: PromiseAction): void {
  switch (action.action) {
    case "function_call":
      w.writeU8(2);
      w.writeString(action.function_name);
      w.writeBytes(base64.decode(action.args));
      w.writeU128(BigInt(action.deposit));
      w.writeU64(BigInt(action.min_gas ?? "0"));
      w.writeU64(BigInt(action.gas_weight ?? "1"));
      break;
    case "transfer":
      w.writeU8(3);
      w.writeU128(BigInt(action.amount));
      break;
    case "state_init":
      w.writeU8(11);
      writeStateInit(w, action.state_init);
      w.writeU128(BigInt(action.deposit));
      break;
  }
}

function writeWalletOp(w: BorshWriter, op: WalletOp): void {
  switch (op.op) {
    case "set_signature_mode":
      w.writeU8(0);
      w.writeBool(op.enable);
      break;
    case "add_extension":
      w.writeU8(1);
      w.writeString(op.account_id);
      break;
    case "remove_extension":
      w.writeU8(2);
      w.writeString(op.account_id);
      break;
  }
}

function writeStateInit(w: BorshWriter, si: StateInitJSON): void {
  w.writeU8(0); // V1 discriminant
  const code = si.V1.code;
  if ("hash" in code) {
    w.writeU8(0);
    for (const b of code.hash) w.writeU8(b);
  } else {
    w.writeU8(1);
    w.writeString(code.account_id);
  }
  const entries = [...si.V1.data.entries()];
  w.writeU32(entries.length);
  for (const [key, value] of entries) {
    w.writeBytes(key);
    w.writeBytes(value);
  }
}

// ─── State Init & Account ID Derivation ──────────────────────────────────────

function buildWalletState(compressedPublicKey: Uint8Array): Uint8Array {
  const w = new BorshWriter();
  // signature_enabled: bool
  w.writeBool(true);
  // wallet_id: u32
  w.writeU32(DEFAULT_WALLET_ID);
  // public_key: [u8; 33] (compressed P-256)
  for (const b of compressedPublicKey) w.writeU8(b);
  // timeout_secs: u32
  w.writeU32(DEFAULT_TIMEOUT_SECS);
  // _last_cleaned_at: u32
  w.writeU32(0);
  // _old_nonces: Vec<(u32, u32)>
  w.writeU32(0);
  // _nonces: Vec<(u32, u32)>
  w.writeU32(0);
  // extensions: Vec<String>
  w.writeU32(0);
  return w.toBytes();
}

function buildStateInit(compressedPublicKey: Uint8Array): { serialized: Uint8Array; json: any } {
  const stateKey = new Uint8Array(0);
  const stateValue = buildWalletState(compressedPublicKey);
  const code = { account_id: WALLET_CONTRACT_ACCOUNT_ID };

  // Borsh serialization for account ID derivation
  const w = new BorshWriter();
  // Enum discriminant: V1 = 0
  w.writeU8(0);
  // code: GlobalContractId enum - AccountId variant = 1
  w.writeU8(1);
  w.writeString(WALLET_CONTRACT_ACCOUNT_ID);
  // data: Vec<(Vec<u8>, Vec<u8>)> sorted entries
  w.writeU32(1); // 1 entry
  w.writeBytes(stateKey);
  w.writeBytes(stateValue);

  const json = {
    version: "v1",
    code,
    data: { [base64.encode(stateKey)]: base64.encode(stateValue) },
  };

  return { serialized: w.toBytes(), json };
}

function deriveAccountId(compressedPublicKey: Uint8Array): string {
  const { serialized } = buildStateInit(compressedPublicKey);
  const hash = keccak_256(serialized);
  return `0s${hex.encode(hash.slice(12, 32))}`;
}

// ─── WebAuthn Helpers ────────────────────────────────────────────────────────

function extractP256PublicKeyHex(spkiBytes: number[]): string {
  const bytes = new Uint8Array(spkiBytes);
  const spkiHeaderLength = 26;
  const uncompressedLength = 65;

  if (
    bytes.length === spkiHeaderLength + uncompressedLength &&
    bytes[spkiHeaderLength] === 0x04
  ) {
    return hex.encode(bytes.slice(spkiHeaderLength));
  }

  if (bytes.length === uncompressedLength && bytes[0] === 0x04) {
    return hex.encode(bytes);
  }

  throw new Error(`Unexpected public key format (${bytes.length} bytes)`);
}

function compressP256PublicKey(publicKeyHex: string): Uint8Array {
  return p256.ProjectivePoint.fromHex(publicKeyHex).toRawBytes(true);
}

function parseP256Signature(derHex: string): string {
  const sig = p256.Signature.fromDER(hex.decode(derHex)).normalizeS();
  return `p256:${base58.encode(sig.toCompactRawBytes())}`;
}

/**
 * Recover the P-256 public key from a WebAuthn assertion response.
 *
 * WebAuthn signs: SHA-256(authenticatorData || SHA-256(clientDataJSON))
 * We try both recovery bits (0 and 1) and return the uncompressed hex
 * of every valid candidate.
 */
function recoverPublicKeysFromAssertion(response: {
  signature: number[];
  authenticatorData: number[];
  clientDataJSON: number[];
}): string[] {
  const authData = new Uint8Array(response.authenticatorData);
  const clientHash = sha256(new Uint8Array(response.clientDataJSON));

  // Signed payload = authenticatorData || SHA-256(clientDataJSON)
  const signedData = new Uint8Array(authData.length + clientHash.length);
  signedData.set(authData);
  signedData.set(clientHash, authData.length);

  const msgHash = sha256(signedData);
  const derBytes = hex.decode(hex.encode(new Uint8Array(response.signature)));
  const sig = p256.Signature.fromDER(derBytes).normalizeS();

  const candidates: string[] = [];
  for (const bit of [0, 1] as const) {
    try {
      const recovered = sig.addRecoveryBit(bit).recoverPublicKey(msgHash);
      candidates.push(recovered.toHex(false)); // uncompressed hex
    } catch {
      // Invalid recovery bit for this signature – skip
    }
  }
  return candidates;
}

// ─── Nonce Generation ────────────────────────────────────────────────────────

let _nonce = 0;
function nextNonce(): number {
  const BIT_POS_MASK = 0b11111;
  if ((_nonce & BIT_POS_MASK) === 0) {
    _nonce = (Math.floor(Math.random() * 0xffffffff) & ~BIT_POS_MASK) >>> 0;
  }
  const n = _nonce;
  _nonce++;
  return n;
}

// ─── Wallet-Contract Message Building ────────────────────────────────────────

function buildRequestMessage(
  accountId: string,
  request: WalletRequest,
  network: Network,
): WalletRequestMessage {
  return {
    chain_id: network === "testnet" ? "testnet" : "mainnet",
    signer_id: accountId,
    nonce: nextNonce(),
    created_at: new Date(Math.floor(Date.now() / 1000 - 60) * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    timeout_secs: DEFAULT_TIMEOUT_SECS,
    request,
  };
}

function computeChallenge(msg: WalletRequestMessage): Uint8Array {
  const borshBytes = serializeRequestMessage(msg);
  const prefixed = new Uint8Array(WALLET_DOMAIN.length + borshBytes.length);
  prefixed.set(WALLET_DOMAIN);
  prefixed.set(borshBytes, WALLET_DOMAIN.length);
  return sha256(prefixed);
}

function buildProof(response: {
  signature: number[];
  authenticatorData: number[];
  clientDataJSON: number[];
}): string {
  const signatureHex = hex.encode(new Uint8Array(response.signature));
  return JSON.stringify({
    authenticator_data: base64url.encode(new Uint8Array(response.authenticatorData)),
    client_data_json: new TextDecoder().decode(new Uint8Array(response.clientDataJSON)),
    signature: parseP256Signature(signatureHex),
  });
}

// ─── ConnectorAction -> WalletContract PromiseAction Conversion ──────────────

function connectorActionsToWalletPromises(
  transactions: Array<{ receiverId: string; actions: ConnectorAction[] }>,
): PromiseDag {
  const singles: PromiseSingle[] = transactions.map((tx) => ({
    receiver_id: tx.receiverId,
    actions: tx.actions.map(connectorActionToPromiseAction),
  }));

  return { after: [], then: singles };
}

function connectorActionToPromiseAction(action: ConnectorAction): PromiseAction {
  switch (action.type) {
    case "FunctionCall":
      return {
        action: "function_call",
        function_name: action.params.methodName,
        args: base64.encode(new TextEncoder().encode(JSON.stringify(action.params.args))),
        deposit: action.params.deposit,
      };
    case "Transfer":
      return {
        action: "transfer",
        amount: action.params.deposit,
      };
    default:
      throw new Error(`Action type "${action.type}" is not supported by Passkey wallet-contract. Only FunctionCall and Transfer are supported.`);
  }
}

// ─── Raw Transaction Serialization (for StateInit action support) ────────────

const provider = new NearRpc(window.selector?.providers?.mainnet);

/**
 * Serialize a StateInit action in Borsh format.
 * This is Action enum variant index 11 in the NEAR protocol.
 * Layout: variant(u8=11) + StateInit(borsh) + deposit(u128)
 */
function serializeStateInitAction(compressedPublicKey: Uint8Array): Uint8Array {
  const { serialized: stateInitBorsh } = buildStateInit(compressedPublicKey);
  const w = new BorshWriter();
  // Action enum variant: StateInit = 11
  w.writeU8(11);
  // StateInit data (already borsh-serialized as an enum with V1 variant)
  for (const b of stateInitBorsh) w.writeU8(b);
  // deposit: u128 = 0
  w.writeU128(0n);
  return w.toBytes();
}

/**
 * Serialize a FunctionCall action in Borsh format.
 * Action enum variant index 2.
 */
function serializeFunctionCallAction(
  methodName: string,
  args: object,
  gas: bigint,
  deposit: bigint,
): Uint8Array {
  const w = new BorshWriter();
  // Action enum variant: FunctionCall = 2
  w.writeU8(2);
  // method_name: String
  w.writeString(methodName);
  // args: Vec<u8>
  const argsBytes = new TextEncoder().encode(JSON.stringify(args));
  w.writeBytes(argsBytes);
  // gas: u64
  w.writeU64(gas);
  // deposit: u128
  w.writeU128(deposit);
  return w.toBytes();
}

/**
 * Serialize a complete NEAR Transaction in Borsh format.
 * We do this manually to support the StateInit action that the JS SDK doesn't have yet.
 */
function serializeRawTransaction(
  signerId: string,
  publicKey: PublicKey,
  receiverId: string,
  nonce: number,
  blockHash: Uint8Array,
  rawActions: Uint8Array[],
): Uint8Array {
  const w = new BorshWriter();
  // signer_id: String
  w.writeString(signerId);
  // public_key: PublicKey (enum variant 0 = ED25519, then 32 bytes)
  const pkBytes = publicKey.data;
  w.writeU8(0); // ED25519
  for (const b of pkBytes) w.writeU8(b);
  // nonce: u64
  w.writeU64(BigInt(nonce));
  // receiver_id: String
  w.writeString(receiverId);
  // block_hash: [u8; 32]
  for (const b of blockHash) w.writeU8(b);
  // actions: Vec<Action> — we write the length then raw pre-serialized actions
  w.writeU32(rawActions.length);
  for (const actionBytes of rawActions) {
    for (const b of actionBytes) w.writeU8(b);
  }
  return w.toBytes();
}

/**
 * Serialize a SignedTransaction wrapping raw transaction bytes.
 */
function serializeRawSignedTransaction(
  txBytes: Uint8Array,
  signatureBytes: Uint8Array,
): Uint8Array {
  const w = new BorshWriter();
  // transaction bytes (inline, not length-prefixed — it's a struct not a vec)
  for (const b of txBytes) w.writeU8(b);
  // signature: Signature enum (variant 0 = ED25519, then 64 bytes)
  w.writeU8(0);
  for (const b of signatureBytes) w.writeU8(b);
  return w.toBytes();
}

async function getRelayerInfo() {
  const relayerKeyPair = KeyPair.fromString(RELAYER_PRIVATE_KEY);
  const relayerPublicKey = relayerKeyPair.getPublicKey();

  const [block, accessKey] = await Promise.all([
    provider.block({ finality: "final" }),
    provider.query<any>({
      request_type: "view_access_key",
      finality: "final",
      account_id: RELAYER_ACCOUNT_ID,
      public_key: relayerPublicKey.toString(),
    }),
  ]);

  return {
    keyPair: relayerKeyPair,
    publicKey: relayerPublicKey,
    nonce: accessKey.nonce + 1,
    blockHash: baseDecode(block.header.hash),
  };
}

async function signAndSendRawTransaction(
  receiverId: string,
  rawActions: Uint8Array[],
): Promise<FinalExecutionOutcome> {
  const { keyPair, publicKey, nonce, blockHash } = await getRelayerInfo();

  const txBytes = serializeRawTransaction(
    RELAYER_ACCOUNT_ID,
    publicKey,
    receiverId,
    nonce,
    blockHash,
    rawActions,
  );

  const txHash = sha256(txBytes);
  const signature = keyPair.sign(txHash);

  const signedTxBytes = serializeRawSignedTransaction(txBytes, signature.signature);
  const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");

  return provider.sendJsonRpc<FinalExecutionOutcome>("broadcast_tx_commit", [signedTxBase64]);
}

// ─── Relay Transaction via Sponsor Account ───────────────────────────────────

async function relayWalletContractCall(
  walletAccountId: string,
  msg: WalletRequestMessage,
  proof: string,
  compressedPublicKey: Uint8Array,
  includeStateInit: boolean,
): Promise<FinalExecutionOutcome> {
  const rawActions: Uint8Array[] = [];

  if (includeStateInit) {
    rawActions.push(serializeStateInitAction(compressedPublicKey));
  }

  // w_execute_signed call with 300 TGas and 1 yoctoNEAR deposit
  rawActions.push(
    serializeFunctionCallAction(
      "w_execute_signed",
      { msg, proof },
      300_000_000_000_000n, // 300 TGas
      1n, // 1 yoctoNEAR
    ),
  );

  return signAndSendRawTransaction(walletAccountId, rawActions);
}

// ─── Relay a state_init transaction (account creation) ───────────────────────

async function relayStateInit(
  walletAccountId: string,
  compressedPublicKey: Uint8Array,
): Promise<FinalExecutionOutcome> {
  return signAndSendRawTransaction(walletAccountId, [
    serializeStateInitAction(compressedPublicKey),
  ]);
}

// ─── Core Sign Flow ──────────────────────────────────────────────────────────

async function signWithPasskey(
  credentialId: number[],
  msg: WalletRequestMessage,
): Promise<string> {
  const challenge = computeChallenge(msg);

  const assertion = await window.selector.webauthn.get({
    challenge: Array.from(challenge),
    allowCredentials: [
      {
        id: credentialId,
        type: "public-key",
        transports: ["internal"],
      },
    ],
    userVerification: "preferred",
  });

  return buildProof(assertion);
}

async function signAndRelay(
  accountId: string,
  compressedPublicKey: Uint8Array,
  credentialId: number[],
  request: WalletRequest,
  network: Network,
  includeStateInit: boolean,
): Promise<FinalExecutionOutcome> {
  const msg = buildRequestMessage(accountId, request, network);
  const proof = await signWithPasskey(credentialId, msg);

  return relayWalletContractCall(
    accountId,
    msg,
    proof,
    compressedPublicKey,
    includeStateInit,
  );
}

// ─── Check if wallet-contract account exists ─────────────────────────────────

async function accountExists(accountId: string): Promise<boolean> {
  try {
    await provider.query<any>({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── NEP-413 Sign Message ────────────────────────────────────────────────────

function buildNep413Payload(message: string, recipient: string, nonce: Uint8Array | number[]): Uint8Array {
  const nonceBytes = nonce instanceof Uint8Array ? nonce : new Uint8Array(nonce);
  // NEP-413 payload: tag (2147484061 as u32 LE) + message + nonce (32 bytes) + recipient + callbackUrl (optional)
  const tag = new Uint8Array([0x8d, 0x01, 0x00, 0x80]); // 2147484045 in LE - NEP-413 tag
  const messageBytes = new TextEncoder().encode(message);
  const recipientBytes = new TextEncoder().encode(recipient);

  const w = new BorshWriter();
  // tag
  for (const b of tag) w.writeU8(b);
  // message (length-prefixed string)
  w.writeString(message);
  // nonce (fixed 32 bytes)
  for (const b of nonceBytes) w.writeU8(b);
  // recipient
  w.writeString(recipient);
  // callbackUrl (None)
  w.writeU8(0);
  return w.toBytes();
}

// ─── Passkey Wallet Implementation ───────────────────────────────────────────

const PasskeyWallet = async () => {
  // Load saved state
  let credentialId: number[] | null = null;
  let publicKeyHex: string | null = null;
  let compressedPublicKey: Uint8Array | null = null;
  let accountId: string | null = null;

  const savedCredentialId = window.localStorage.getItem(STORAGE_KEY_CREDENTIAL_ID);
  const savedPublicKey = window.localStorage.getItem(STORAGE_KEY_PUBLIC_KEY);
  const savedAccountId = window.localStorage.getItem(STORAGE_KEY_ACCOUNT_ID);

  if (savedCredentialId && savedPublicKey && savedAccountId) {
    credentialId = JSON.parse(savedCredentialId);
    publicKeyHex = savedPublicKey;
    compressedPublicKey = compressP256PublicKey(publicKeyHex);
    accountId = savedAccountId;
  }

  function isSignedIn(): boolean {
    return !!(credentialId && publicKeyHex && accountId);
  }

  function savePasskeyState(
    newCredentialId: number[],
    newPublicKeyHex: string,
    newCompressedKey: Uint8Array,
    newAccountId: string,
  ) {
    credentialId = newCredentialId;
    publicKeyHex = newPublicKeyHex;
    compressedPublicKey = newCompressedKey;
    accountId = newAccountId;

    window.localStorage.setItem(STORAGE_KEY_CREDENTIAL_ID, JSON.stringify(credentialId));
    window.localStorage.setItem(STORAGE_KEY_PUBLIC_KEY, publicKeyHex);
    window.localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, accountId);
  }

  /**
   * Try to authenticate with an existing discoverable passkey.
   * Recovers the P-256 public key from the ECDSA signature so that
   * the same passkey always maps to the same NEAR account.
   *
   * Returns null if the user cancels or has no passkey for this RP.
   */
  async function tryExistingPasskey(): Promise<{
    credentialId: number[];
    publicKeyHex: string;
    compressedPublicKey: Uint8Array;
    accountId: string;
  } | null> {
    try {
      // Use a known challenge so we can recover the public key
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await window.selector.webauthn.get({
        challenge: Array.from(challenge),
        // Empty allowCredentials → browser shows discoverable credentials picker
        userVerification: "preferred",
      });

      if (!assertion) return null;

      // Recover the P-256 public key from the ECDSA signature
      const candidates = recoverPublicKeysFromAssertion(assertion);
      if (candidates.length === 0) {
        throw new Error("Could not recover public key from passkey signature");
      }

      // Try each candidate: the correct one will produce an account that either
      // exists on-chain or is the only option.
      for (const candidateHex of candidates) {
        const compressed = compressP256PublicKey(candidateHex);
        const derivedAccountId = deriveAccountId(compressed);
        const exists = await accountExists(derivedAccountId);

        if (exists) {
          savePasskeyState(assertion.rawId, candidateHex, compressed, derivedAccountId);
          return { credentialId: assertion.rawId, publicKeyHex: candidateHex, compressedPublicKey: compressed, accountId: derivedAccountId };
        }
      }

      // No existing on-chain account found – use the first candidate
      // (this is a returning passkey whose account hasn't been initialized yet)
      const chosenHex = candidates[0];
      const compressed = compressP256PublicKey(chosenHex);
      const derivedAccountId = deriveAccountId(compressed);

      savePasskeyState(assertion.rawId, chosenHex, compressed, derivedAccountId);
      return { credentialId: assertion.rawId, publicKeyHex: chosenHex, compressedPublicKey: compressed, accountId: derivedAccountId };
    } catch {
      // User cancelled, no discoverable credentials, or browser doesn't support it
      return null;
    }
  }

  async function createNewPasskey(): Promise<{
    credentialId: number[];
    publicKeyHex: string;
    compressedPublicKey: Uint8Array;
    accountId: string;
  }> {
    const result = await window.selector.webauthn.create({
      challenge: Array.from(crypto.getRandomValues(new Uint8Array(32))),
      rp: { name: "NEAR Passkey Wallet" },
      user: {
        id: Array.from(crypto.getRandomValues(new Uint8Array(16))),
        name: "near-passkey-user",
        displayName: "NEAR Passkey User",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256 (P-256)
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
      attestation: "none",
    });

    if (!result || !result.publicKey) {
      throw new Error("Passkey creation failed: no public key returned");
    }

    const newCredentialId = result.rawId;
    const newPublicKeyHex = extractP256PublicKeyHex(result.publicKey);
    const newCompressedKey = compressP256PublicKey(newPublicKeyHex);
    const newAccountId = deriveAccountId(newCompressedKey);

    savePasskeyState(newCredentialId, newPublicKeyHex, newCompressedKey, newAccountId);
    return { credentialId: newCredentialId, publicKeyHex: newPublicKeyHex, compressedPublicKey: newCompressedKey, accountId: newAccountId };
  }

  async function createOrGetPasskey(): Promise<{
    credentialId: number[];
    publicKeyHex: string;
    compressedPublicKey: Uint8Array;
    accountId: string;
  }> {
    // 1. Already signed in (loaded from localStorage)
    if (isSignedIn()) {
      return {
        credentialId: credentialId!,
        publicKeyHex: publicKeyHex!,
        compressedPublicKey: compressedPublicKey!,
        accountId: accountId!,
      };
    }

    // 2. No saved state — prompt user to create a new passkey.
    //    The UI prompt also offers a recovery path for returning users
    //    who already have a passkey but lost their local storage.
    window.selector.ui.showIframe();

    return new Promise<{
      credentialId: number[];
      publicKeyHex: string;
      compressedPublicKey: Uint8Array;
      accountId: string;
    }>((resolve, reject) => {
      const root = document.getElementById("root")!;
      root.style.display = "flex";
      root.innerHTML = `
        <div class="prompt-container">
          <h1>Passkey Wallet</h1>
          <p>Create a new passkey or use an existing one</p>
          <button id="passkey-create">Create new Passkey</button>
          <button id="passkey-recover" style="background-color:#1a1a1a;margin-top:8px;">I already have a Passkey</button>
        </div>
      `;

      root.querySelector("#passkey-create")!.addEventListener("click", async () => {
        root.innerHTML = "";
        root.style.display = "none";
        window.selector.ui.hideIframe();
        try {
          resolve(await createNewPasskey());
        } catch (e) {
          reject(e);
        }
      });

      root.querySelector("#passkey-recover")!.addEventListener("click", async () => {
        root.innerHTML = "";
        root.style.display = "none";
        window.selector.ui.hideIframe();
        try {
          const existing = await tryExistingPasskey();
          if (existing) {
            resolve(existing);
          } else {
            reject(new Error("No existing passkey found"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async function ensureAccountInitialized(acctId: string, compKey: Uint8Array): Promise<void> {
    const exists = await accountExists(acctId);
    if (!exists) {
      await relayStateInit(acctId, compKey);
    }
  }

  // ─── Return Wallet Interface ─────────────────────────────────────────────

  return {
    async signIn({ network, addFunctionCallKey }: SignInParams) {
      const passkey = await createOrGetPasskey();
      await ensureAccountInitialized(passkey.accountId, passkey.compressedPublicKey);

      if (addFunctionCallKey) {
        // Build a wallet-contract request that includes an AddKey action
        // via a function call to the account itself
        const addKeyRequest: WalletRequest = {
          ops: [],
          out: {
            after: [],
            then: [{
              receiver_id: passkey.accountId,
              actions: [{
                action: "function_call",
                function_name: "add_key",
                args: base64.encode(new TextEncoder().encode(JSON.stringify({
                  public_key: addFunctionCallKey.publicKey,
                  access_key: {
                    permission: {
                      FunctionCall: {
                        receiver_id: addFunctionCallKey.contractId,
                        method_names: addFunctionCallKey.allowMethods.anyMethod === false
                          ? addFunctionCallKey.allowMethods.methodNames
                          : [],
                        allowance: addFunctionCallKey.gasAllowance?.kind === "limited"
                          ? addFunctionCallKey.gasAllowance.amount
                          : null,
                      },
                    },
                  },
                }))),
                deposit: "0",
              }],
            }],
          },
        };

        await signAndRelay(
          passkey.accountId,
          passkey.compressedPublicKey,
          passkey.credentialId,
          addKeyRequest,
          network,
          false,
        );
      }

      return [{ accountId: passkey.accountId, publicKey: `p256:${base58.encode(passkey.compressedPublicKey)}` }];
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      const { network, messageParams, addFunctionCallKey } = data;

      // First sign in
      const accounts = await this.signIn({ network, addFunctionCallKey });
      const acct = accounts[0];

      // Sign the message using passkey (via wallet-contract)
      const signedMessage = await this.signMessage({
        message: messageParams.message,
        recipient: messageParams.recipient,
        nonce: messageParams.nonce,
        network,
      });

      return [{
        accountId: acct.accountId,
        publicKey: acct.publicKey,
        signedMessage,
      }];
    },

    async signOut() {
      credentialId = null;
      publicKeyHex = null;
      compressedPublicKey = null;
      accountId = null;
      window.localStorage.removeItem(STORAGE_KEY_CREDENTIAL_ID);
      window.localStorage.removeItem(STORAGE_KEY_PUBLIC_KEY);
      window.localStorage.removeItem(STORAGE_KEY_ACCOUNT_ID);
    },

    async getAccounts() {
      if (!isSignedIn()) return [{ accountId: "", publicKey: "" }];
      return [{ accountId: accountId!, publicKey: `p256:${base58.encode(compressedPublicKey!)}` }];
    },

    async signMessage({ message, recipient, nonce, network }: {
      message: string;
      recipient: string;
      nonce: Uint8Array | number[];
      network?: Network;
    }): Promise<SignedMessage> {
      if (!isSignedIn()) throw new Error("Wallet not signed in");

      // Build the NEP-413 payload hash
      const payload = buildNep413Payload(message, recipient, nonce);
      const payloadHash = sha256(payload);

      // Use the passkey to sign the payload hash directly via WebAuthn
      const challenge = payloadHash;

      const assertion = await window.selector.webauthn.get({
        challenge: Array.from(challenge),
        allowCredentials: [
          {
            id: credentialId!,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "preferred",
      });

      const signatureHex = hex.encode(new Uint8Array(assertion.signature));
      const sig = p256.Signature.fromDER(hex.decode(signatureHex)).normalizeS();

      return {
        accountId: accountId!,
        publicKey: `p256:${base58.encode(compressedPublicKey!)}`,
        signature: base64.encode(sig.toCompactRawBytes()),
      };
    },

    async signAndSendTransaction({
      receiverId,
      actions,
      network,
    }: {
      receiverId: string;
      actions: ConnectorAction[];
      network: Network;
    }): Promise<FinalExecutionOutcome> {
      if (!isSignedIn()) throw new Error("Wallet not signed in");

      const request: WalletRequest = {
        ops: [],
        out: connectorActionsToWalletPromises([{ receiverId, actions }]),
      };

      return signAndRelay(
        accountId!,
        compressedPublicKey!,
        credentialId!,
        request,
        network,
        false,
      );
    },

    async signAndSendTransactions({
      transactions,
      network,
    }: {
      transactions: Array<{ receiverId: string; actions: ConnectorAction[] }>;
      network: Network;
    }): Promise<FinalExecutionOutcome[]> {
      if (!isSignedIn()) throw new Error("Wallet not signed in");

      // Bundle all transactions into a single wallet-contract request
      const request: WalletRequest = {
        ops: [],
        out: connectorActionsToWalletPromises(transactions),
      };

      const result = await signAndRelay(
        accountId!,
        compressedPublicKey!,
        credentialId!,
        request,
        network,
        false,
      );

      // The wallet-contract executes all promises atomically, return the single outcome for each
      return transactions.map(() => result);
    },

    async signDelegateActions({
      delegateActions,
      network,
    }: {
      delegateActions: Array<{ receiverId: string; actions: ConnectorAction[] }>;
      network?: Network;
    }) {
      if (!isSignedIn()) throw new Error("Wallet not signed in");

      const net = network || "mainnet";

      // Build the wallet-contract request for the delegate actions
      const request: WalletRequest = {
        ops: [],
        out: connectorActionsToWalletPromises(delegateActions),
      };

      const msg = buildRequestMessage(accountId!, request, net);
      const proof = await signWithPasskey(credentialId!, msg);

      // Return the signed wallet-contract request as a base64-encoded JSON
      // This can be relayed by any party that understands the wallet-contract protocol
      const { json: stateInit } = buildStateInit(compressedPublicKey!);
      const signedRequest = JSON.stringify({ msg, proof, stateInit });
      const encoded = base64.encode(new TextEncoder().encode(signedRequest));

      return { signedDelegateActions: [encoded] };
    },

    async verifyOwner() {
      throw new Error("Method not supported by Passkey Wallet");
    },
  };
};

PasskeyWallet().then((wallet) => {
  window.selector.ready(wallet);
});
