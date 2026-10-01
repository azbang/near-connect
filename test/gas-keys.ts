/**
 * Compile-time assertions for the gas-key (protocol 85+) public surface:
 * the ConnectorAction additions and the fail-closed wallet gate. Compiled
 * (not executed) by `yarn test:gas-keys`; the gate's runtime behavior is
 * exercised by the wallet adapters, which call assertGasKeyActionsSupported
 * before dispatching actions.
 */
import { assertGasKeyActionsSupported, isGasKeyAction, type ConnectorAction } from "../src";

const gasKeyAddKey: ConnectorAction = {
  type: "AddKey",
  params: {
    publicKey: "ed25519:x",
    accessKey: { permission: { receiverId: "app.near", methodNames: ["ping"] } },
    gasKeyInfo: { balance: "0", numNonces: 4 },
  },
};
const fundGasKey: ConnectorAction = { type: "TransferToGasKey", params: { publicKey: "ed25519:x", deposit: "1" } };
const drainGasKey: ConnectorAction = { type: "WithdrawFromGasKey", params: { publicKey: "ed25519:x", amount: "1" } };
const plainTransfer: ConnectorAction = { type: "Transfer", params: { deposit: "1" } };

void gasKeyAddKey;
void fundGasKey;
void drainGasKey;

isGasKeyAction(gasKeyAddKey);
isGasKeyAction(plainTransfer);
assertGasKeyActionsSupported({ gasKeys: true }, [fundGasKey], "Test Wallet");
assertGasKeyActionsSupported(undefined, [plainTransfer], "Test Wallet");
