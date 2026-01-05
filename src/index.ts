export { type DataStorage, LocalStorage } from "./helpers/storage";
export { ParentFrameWallet } from "./ParentFrameWallet";
export { SandboxWallet } from "./SandboxedWallet";
export { InjectedWallet } from "./InjectedWallet";
export { NearConnector } from "./NearConnector";

export { nearActionsToConnectorActions } from "./actions";
export type { ConnectorAction } from "./actions/types";

export type {
  NearWalletBase,
  WalletManifest,
  EventNearWalletInjected,
  SignMessageParams,
  SignedMessage,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
} from "./types";
