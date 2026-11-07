/**
 * Verification of manifests signed by the registry contract (contracts/registry) through NEAR MPC.
 *
 * Envelope (what `get_signed_manifest` returns and what can be mirrored to a CDN as is):
 *   { "manifest": "<manifest JSON as a string>", "signature": { sequence, sha256, signature, public_key } }
 *
 * Signed message: "near-connect:manifest:v1:" || sequence (u64 big-endian) || sha256(manifest bytes)
 */
import { decodeBase58 } from "./base58";
import { normalizeHash, sha256Hex } from "./onchain";

export const MANIFEST_SIGNING_PREFIX = "near-connect:manifest:v1:";

export interface ManifestSignature {
  sequence: number;
  sha256: string;
  signature: string;
  public_key: string;
}

export interface SignedManifestEnvelope {
  manifest: string;
  signature: ManifestSignature | null;
}

export function isSignedManifestEnvelope(value: unknown): value is SignedManifestEnvelope {
  return typeof value === "object" && value !== null && typeof (value as any).manifest === "string" && "signature" in value;
}

const hexToBytes = (hex: string) => {
  if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new Error("Invalid hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
};

export function parseEd25519PublicKey(key: string): Uint8Array {
  const [curve, data] = key.includes(":") ? key.split(":") : ["ed25519", key];
  if (curve !== "ed25519") throw new Error(`Manifest key must be ed25519, got ${curve}`);
  const bytes = decodeBase58(data);
  if (bytes.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  return bytes;
}

export function manifestMessage(sequence: number, sha256: string): Uint8Array {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("Invalid manifest sequence");
  const prefix = new TextEncoder().encode(MANIFEST_SIGNING_PREFIX);
  const hash = hexToBytes(sha256);
  if (hash.length !== 32) throw new Error("Invalid manifest sha256");

  const message = new Uint8Array(prefix.length + 8 + 32);
  message.set(prefix, 0);
  new DataView(message.buffer).setBigUint64(prefix.length, BigInt(sequence), false);
  message.set(hash, prefix.length + 8);
  return message;
}

async function verifyEd25519(publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array) {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("Manifest signature check needs WebCrypto (https or localhost)");
  // Fails closed on browsers without WebCrypto Ed25519 (pre-2025 Chrome): importKey throws
  const key = await crypto.subtle.importKey("raw", publicKey as BufferSource, { name: "Ed25519" }, false, ["verify"]);
  return await crypto.subtle.verify({ name: "Ed25519" }, key, signature as BufferSource, message as BufferSource);
}

/**
 * Returns the parsed manifest and its sequence, or throws. `trustedKeys` are `ed25519:<base58>` keys
 * pinned by the dApp/SDK; the key embedded in the envelope is only a hint and must be one of them.
 */
export async function verifySignedManifest<T = unknown>(envelope: SignedManifestEnvelope, trustedKeys: string[]) {
  const sig = envelope.signature;
  if (!sig) throw new Error("Manifest is not signed yet");

  const trusted = trustedKeys.map(parseEd25519PublicKey);
  const embedded = parseEd25519PublicKey(sig.public_key);
  const key = trusted.find((k) => k.every((b, i) => b === embedded[i]));
  if (!key) throw new Error(`Manifest is signed by an untrusted key ${sig.public_key}`);

  const actualSha = await sha256Hex(envelope.manifest);
  if (actualSha !== normalizeHash(sig.sha256)) throw new Error("Manifest does not match its signed sha256");

  const signature = hexToBytes(sig.signature);
  if (signature.length !== 64) throw new Error("Ed25519 signature must be 64 bytes");
  if (!(await verifyEd25519(key, signature, manifestMessage(sig.sequence, actualSha)))) throw new Error("Invalid manifest signature");

  return { manifest: JSON.parse(envelope.manifest) as T, sequence: sig.sequence };
}
