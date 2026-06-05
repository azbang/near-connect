import type {
  AccountWithSignedMessage,
  NearWalletBase,
  ResolveAuthParams,
  ResolveAuthResponse,
  SignInAndSignMessageParams,
  SignedMessage,
} from "../types";

/**
 * NEP-641 default `resolveAuth` implementation, built on top of NEP-413
 * `signMessage`. Per NEP-641 §"NEP-413 fallback", the `purpose` is bound
 * into the signed material by prefixing the `recipient` field with
 * `"<PURPOSE>@"`. The dApp backend reconstructs the same prefix when it
 * cannot find `w_resolve_auth` on the account and falls back to NEP-413
 * verification.
 *
 * If the user is not yet signed in to the wallet, the helper uses
 * `signInAndSignMessage` to combine sign-in and authorization into a single
 * user gesture; otherwise it uses the standalone `signMessage` against the
 * already-connected account.
 *
 * The returned `authorization` is a JSON-stringified NEP-413 `SignedMessage`
 * extended with the original `purpose`, `recipient`, and `payload` so the
 * dApp can fully reconstruct the verification input without out-of-band
 * context. The bound `recipient` used inside the NEP-413 signature is
 * `"<PURPOSE>@<recipient>"`.
 */
export async function defaultResolveAuthViaSignMessage(
  wallet: Pick<NearWalletBase, "signMessage" | "signInAndSignMessage" | "getAccounts">,
  params: ResolveAuthParams,
): Promise<ResolveAuthResponse> {
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const boundRecipient = `${params.purpose}@${params.recipient}`;
  const messageParams = { message: params.payload, recipient: boundRecipient, nonce };

  const accounts = await wallet.getAccounts({ network: params.network }).catch(() => []);
  const isConnected = !!(accounts?.length && accounts[0]?.accountId);

  let signed: SignedMessage;
  if (!isConnected) {
    const result = await wallet.signInAndSignMessage({
      network: params.network,
      messageParams,
    });
    if (!result?.length || !result[0]?.signedMessage) {
      throw new Error("Wallet returned no signed message during sign-in");
    }
    signed = result[0].signedMessage;
  } else {
    signed = await wallet.signMessage({ ...messageParams, network: params.network });
  }

  // NEP-641 §"NEP-413 fallback": the authorization blob is a NEP-413
  // `SignedMessage` so a generic resolver can verify it without out-of-band
  // context. Includes the SignedMessagePayload fields (message, recipient,
  // nonce, callbackUrl) needed to recompute the borsh hash.
  const authorization = JSON.stringify({
    accountId: signed.accountId,
    publicKey: signed.publicKey,
    signature: signed.signature,
    message: params.payload,
    recipient: boundRecipient,
    nonce: bytesToBase64(nonce),
    callbackUrl: null,
    state: null,
  });

  return { accountId: signed.accountId, authorization };
}

/**
 * Polyfill `signInAndSignMessage` for wallets that don't support the combined
 * flow natively but expose `signIn` (without addKey) + `signMessage`. The
 * polyfill runs sign-in followed by a separate signMessage on the
 * newly-connected account. Two user gestures instead of one.
 */
export async function polyfillSignInAndSignMessage(
  wallet: Pick<NearWalletBase, "signIn" | "signMessage">,
  data: SignInAndSignMessageParams,
): Promise<AccountWithSignedMessage[]> {
  const accounts = await wallet.signIn({
    network: data.network,
    addFunctionCallKey: data.addFunctionCallKey,
  });
  const signedMessage = await wallet.signMessage({
    ...data.messageParams,
    network: data.network,
  });
  return accounts.map((account) => ({ ...account, signedMessage }));
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * Detects the "method not found" signal from a wallet's native `resolveAuth`
 * attempt. The sandbox executor rejects with the literal string
 * `"Method not found"` when the wallet code doesn't implement the method;
 * injected/parent-frame wallets surface the same condition via an `Error`
 * with a similar message. Used by the wrappers to fall through to the
 * default signMessage-based implementation even when the manifest claims
 * `resolveAuth: true`.
 */
export function isResolveAuthMethodNotFound(e: unknown): boolean {
  const probe =
    typeof e === "string"
      ? e
      : typeof (e as { message?: unknown } | undefined)?.message === "string"
        ? (e as { message: string }).message
        : "";
  const lower = probe.toLowerCase();
  return lower.includes("method not found") || lower.includes("methodnotfound");
}
