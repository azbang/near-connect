import type { ConnectorAction } from "./types";
import type { WalletFeatures } from "../types";

/** The three connector-action shapes that only a gas-key-aware wallet can sign. */
export const isGasKeyAction = (action: ConnectorAction): boolean =>
  action.type === "TransferToGasKey" ||
  action.type === "WithdrawFromGasKey" ||
  (action.type === "AddKey" && action.params.gasKeyInfo != null);

/**
 * Refuse gas-key actions unless the wallet advertises `features.gasKeys`.
 *
 * Fail-closed on purpose: a wallet that predates gas keys would at best reject
 * the request, and at worst ignore the unknown `gasKeyInfo` field and add a
 * *plain* key with whatever permission it does understand. Flip the manifest
 * flag for a wallet only after a real sign-and-send has been verified with it.
 */
export function assertGasKeyActionsSupported(
  features: Partial<WalletFeatures> | undefined,
  actions: ConnectorAction[],
  walletName: string,
): void {
  if (features?.gasKeys) return;
  const offending = actions.filter(isGasKeyAction).map((action) => action.type);
  if (offending.length === 0) return;
  throw new Error(
    `${walletName} does not advertise gas-key support (manifest features.gasKeys), so ${[...new Set(offending)].join(", ")} ` +
      "cannot be sent through it; a wallet that does not know gasKeyInfo could add a plain key instead. " +
      "Sign locally with a full-access key, or use a wallet whose manifest sets features.gasKeys.",
  );
}
