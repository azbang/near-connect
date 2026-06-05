"use strict";
// NEP-641 client-side resolver. Implements the canonical caller-side
// algorithm from nep-0641.md §"Caller-side resolution algorithm", including
// the NEP-413 fallback (§"NEP-413 fallback").
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResolveAuth = verifyResolveAuth;
const ed25519_1 = require("@noble/curves/ed25519");
const sha2_1 = require("@noble/hashes/sha2");
const base_1 = require("@scure/base");
const NEP413_TAG = 2147484061; // 2^31 + 413
// ─── RPC ─────────────────────────────────────────────────────────────────────
async function rpc(rpcUrl, method, params) {
    const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await resp.json();
    if (json.error) {
        // Generic JSON-RPC `message` (e.g. "Server error") hides the actual
        // failure, which lives in `error.data` and `error.cause`. Concatenate
        // them so downstream probes (account-not-found, method-not-found) see
        // the full signal.
        const err = new Error(formatRpcError(json.error));
        err.data = json.error.data;
        err.cause = json.error.cause;
        throw err;
    }
    if (json.result?.error) {
        const data = json.result.error;
        const err = new Error(typeof data === "string" ? data : JSON.stringify(data));
        err.data = data;
        throw err;
    }
    return json.result;
}
function formatRpcError(error) {
    const parts = [];
    if (error.message)
        parts.push(error.message);
    if (error.data != null) {
        parts.push(typeof error.data === "string" ? error.data : JSON.stringify(error.data));
    }
    if (error.cause != null) {
        parts.push(typeof error.cause === "string" ? error.cause : JSON.stringify(error.cause));
    }
    return parts.join(" — ") || "RPC error";
}
async function getFinalBlockId(rpcUrl) {
    const r = await rpc(rpcUrl, "block", { finality: "final" });
    return r.header.height;
}
async function viewCall(rpcUrl, accountId, methodName, args, blockId) {
    const argsBase64 = btoa(JSON.stringify(args));
    const result = await rpc(rpcUrl, "query", {
        request_type: "call_function",
        block_id: blockId,
        account_id: accountId,
        method_name: methodName,
        args_base64: argsBase64,
    });
    return new Uint8Array(result.result);
}
async function fetchAccessKeyList(rpcUrl, accountId, blockId) {
    const result = await rpc(rpcUrl, "query", {
        request_type: "view_access_key_list",
        block_id: blockId,
        account_id: accountId,
    });
    return result.keys ?? [];
}
// Per NEP-641 §"NEP-413 fallback", fall back ONLY when the contract method
// genuinely does not exist (or no contract is deployed at all). We must NOT
// fall back on other compilation/runtime errors — that could mask real bugs
// in a deployed wallet contract.
function isMethodNotFound(e) {
    const err = e;
    const probe = `${err.message ?? ""} ${typeof err.data === "string" ? err.data : JSON.stringify(err.data ?? "")}`.toLowerCase();
    return (
    // contract has no such method
    probe.includes("methodresolveerror") ||
        probe.includes("method not found") ||
        probe.includes("methodnotfound") ||
        probe.includes("methodnamemismatch") ||
        probe.includes("methodutf8error") ||
        // no contract code is deployed on the account
        probe.includes("codedoesnotexist") ||
        probe.includes("contractcodenotfound") ||
        probe.includes("no contract code"));
}
// ─── Borsh / hashing for NEP-413 ─────────────────────────────────────────────
class BorshWriter {
    buf = [];
    writeU8(v) { this.buf.push(v & 0xff); }
    writeU32(v) {
        this.buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    }
    writeString(s) {
        const b = new TextEncoder().encode(s);
        this.writeU32(b.length);
        for (const c of b)
            this.buf.push(c);
    }
    writeBytes(b) { for (const c of b)
        this.buf.push(c); }
    writeOptionString(s) {
        if (s == null)
            this.writeU8(0);
        else {
            this.writeU8(1);
            this.writeString(s);
        }
    }
    toBytes() { return new Uint8Array(this.buf); }
}
function nep413Hash(msg) {
    const w = new BorshWriter();
    w.writeU32(NEP413_TAG);
    w.writeString(msg.message);
    const nonce = base_1.base64.decode(msg.nonce);
    if (nonce.length !== 32)
        throw new Error("nep-413 nonce must be 32 bytes");
    w.writeBytes(nonce);
    w.writeString(msg.recipient);
    w.writeOptionString(msg.callbackUrl ?? null);
    return (0, sha2_1.sha256)(w.toBytes());
}
// ─── ed25519 key/signature decoding ──────────────────────────────────────────
function decodeEd25519PublicKey(s) {
    // Accepts "ed25519:<base58>" (NEAR canonical form).
    if (!s.startsWith("ed25519:"))
        throw new Error("publicKey must start with 'ed25519:'");
    const raw = base_1.base58.decode(s.slice("ed25519:".length));
    if (raw.length !== 32)
        throw new Error(`ed25519 public key must be 32 bytes, got ${raw.length}`);
    return raw;
}
function decodeEd25519Signature(s) {
    // Accept either raw base64 (NEP-413 canonical form for signMessage output)
    // or "ed25519:<base58>" for callers that pre-encoded.
    let raw;
    if (s.startsWith("ed25519:")) {
        raw = base_1.base58.decode(s.slice("ed25519:".length));
    }
    else {
        raw = base_1.base64.decode(s);
    }
    if (raw.length !== 64)
        throw new Error(`ed25519 signature must be 64 bytes, got ${raw.length}`);
    return raw;
}
// ─── NEP-413 fallback ────────────────────────────────────────────────────────
async function nep413Fallback(rpcUrl, accountId, purpose, recipient, authorization, blockId) {
    let msg;
    try {
        msg = JSON.parse(authorization);
    }
    catch {
        return { status: "INVALID", errorMessage: "authorization is not valid NEP-413 JSON" };
    }
    if (!msg.publicKey || !msg.signature || msg.message == null || !msg.recipient || !msg.nonce) {
        return { status: "INVALID", errorMessage: "authorization missing NEP-413 fields" };
    }
    const expectedRecipient = `${purpose}@${recipient}`;
    if (msg.recipient !== expectedRecipient) {
        return { status: "INVALID", errorMessage: `recipient mismatch: expected "${expectedRecipient}"` };
    }
    // Verify the public key is registered on `accountId` at the pinned block.
    const keys = await fetchAccessKeyList(rpcUrl, accountId, blockId);
    if (!keys.some((k) => k.public_key === msg.publicKey)) {
        return { status: "INVALID", errorMessage: "public key not registered on account at pinned block" };
    }
    // Verify ed25519 signature against the precomputed NEP-413 hash.
    let hash;
    try {
        hash = nep413Hash(msg);
    }
    catch (e) {
        return { status: "INVALID", errorMessage: e.message };
    }
    let signature;
    let publicKey;
    try {
        signature = decodeEd25519Signature(msg.signature);
        publicKey = decodeEd25519PublicKey(msg.publicKey);
    }
    catch (e) {
        return { status: "INVALID", errorMessage: e.message };
    }
    if (!ed25519_1.ed25519.verify(signature, hash, publicKey)) {
        return { status: "INVALID", errorMessage: "bad signature" };
    }
    return { status: "RESOLVED", payload: msg.message };
}
// ─── Recursive resolver ──────────────────────────────────────────────────────
async function resolve(rpcUrl, accountId, purpose, recipient, authorization, blockId, depth, maxDepth) {
    if (depth > maxDepth) {
        return { status: "INVALID", errorMessage: "recursion limit exceeded" };
    }
    let viewBytes;
    try {
        viewBytes = await viewCall(rpcUrl, accountId, "w_resolve_auth", { purpose, recipient, authorization }, blockId);
    }
    catch (e) {
        if (isMethodNotFound(e)) {
            try {
                return await nep413Fallback(rpcUrl, accountId, purpose, recipient, authorization, blockId);
            }
            catch (fe) {
                return {
                    status: "INVALID",
                    errorKind: isUnknownAccountError(fe) ? ERROR_KIND_UNKNOWN_ACCOUNT : undefined,
                    errorMessage: fe.message ?? String(fe),
                };
            }
        }
        return {
            status: "INVALID",
            errorKind: isUnknownAccountError(e) ? ERROR_KIND_UNKNOWN_ACCOUNT : undefined,
            errorMessage: e.message ?? String(e),
        };
    }
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder().decode(viewBytes));
    }
    catch {
        return { status: "INVALID", errorMessage: "w_resolve_auth returned non-JSON" };
    }
    if (parsed.status === "RESOLVED") {
        if (parsed.payload == null)
            return { status: "INVALID", errorMessage: "RESOLVED missing payload" };
        return { status: "RESOLVED", payload: parsed.payload };
    }
    if (parsed.status === "INVALID") {
        // NEP-641 §"Authoritative contract method (no downgrade)": once
        // w_resolve_auth returns INVALID, we MUST NOT fall back to NEP-413.
        return {
            status: "INVALID",
            errorKind: parsed.error_kind,
            errorMessage: parsed.error_message ?? "INVALID",
        };
    }
    if (parsed.status === "PENDING") {
        const pendings = parsed.pending_authorizations ?? [];
        if (pendings.length === 0) {
            return { status: "INVALID", errorMessage: "contract returned PENDING with no dependencies" };
        }
        if (parsed.payload == null) {
            return { status: "INVALID", errorMessage: "PENDING missing payload" };
        }
        for (const sub of pendings) {
            const subResult = await resolve(rpcUrl, sub.account_id, sub.purpose, recipient, sub.authorization, blockId, depth + 1, maxDepth);
            if (subResult.status !== "RESOLVED")
                return subResult;
            if (subResult.payload !== parsed.payload) {
                return { status: "INVALID", errorMessage: "payload mismatch in sub-resolution" };
            }
        }
        return { status: "RESOLVED", payload: parsed.payload };
    }
    return { status: "INVALID", errorMessage: `unknown status: ${parsed.status}` };
}
// Account-not-found can transiently appear after a relayer creates the
// wallet-contract account: the dApp's view call may race ahead of the chain
// indexing the new account. Retry the resolution with exponential backoff so
// the caller doesn't see a false negative.
const ACCOUNT_NOT_FOUND_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];
// Internal marker set on the result when the underlying RPC error has the
// typed cause name "UNKNOWN_ACCOUNT". Used to drive the retry loop without
// resorting to free-text error-message parsing.
const ERROR_KIND_UNKNOWN_ACCOUNT = "UNKNOWN_ACCOUNT";
function isUnknownAccountError(e) {
    const err = e;
    return err?.cause?.name === "UNKNOWN_ACCOUNT";
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function verifyResolveAuth(args) {
    const maxDepth = args.maxDepth ?? 8;
    let lastResult = null;
    // Initial attempt + 5 retries with delays 1s, 2s, 4s, 8s, 16s when the
    // resolver reports the account doesn't exist yet.
    for (let attempt = 0; attempt <= ACCOUNT_NOT_FOUND_RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0)
            await sleep(ACCOUNT_NOT_FOUND_RETRY_DELAYS_MS[attempt - 1]);
        // Re-pin the block each attempt so access-key lookups in the NEP-413
        // fallback see the latest chain state once the account materialises.
        const blockId = args.blockId ?? (await getFinalBlockId(args.rpcUrl));
        lastResult = await resolve(args.rpcUrl, args.accountId, args.purpose, args.recipient, args.authorization, blockId, 0, maxDepth);
        if (lastResult.status === "RESOLVED")
            return lastResult;
        if (lastResult.errorKind !== ERROR_KIND_UNKNOWN_ACCOUNT)
            return lastResult;
    }
    return lastResult;
}
//# sourceMappingURL=verifyResolveAuth.js.map