import type { AccountWithSignedMessage, NearWalletBase, ResolveAuthParams, ResolveAuthResponse, SignInAndSignMessageParams } from "../types";
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
export declare function defaultResolveAuthViaSignMessage(wallet: Pick<NearWalletBase, "signMessage" | "signInAndSignMessage" | "getAccounts">, params: ResolveAuthParams): Promise<ResolveAuthResponse>;
/**
 * Polyfill `signInAndSignMessage` for wallets that don't support the combined
 * flow natively but expose `signIn` (without addKey) + `signMessage`. The
 * polyfill runs sign-in followed by a separate signMessage on the
 * newly-connected account. Two user gestures instead of one.
 */
export declare function polyfillSignInAndSignMessage(wallet: Pick<NearWalletBase, "signIn" | "signMessage">, data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]>;
/**
 * Detects the "method not found" signal from a wallet's native `resolveAuth`
 * attempt. The sandbox executor rejects with the literal string
 * `"Method not found"` when the wallet code doesn't implement the method;
 * injected/parent-frame wallets surface the same condition via an `Error`
 * with a similar message. Used by the wrappers to fall through to the
 * default signMessage-based implementation even when the manifest claims
 * `resolveAuth: true`.
 */
export declare function isResolveAuthMethodNotFound(e: unknown): boolean;
