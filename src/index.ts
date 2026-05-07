export { type DataStorage, LocalStorage } from "./helpers/storage";
export { ParentFrameWallet } from "./ParentFrameWallet";
export { SandboxWallet } from "./SandboxedWallet";
export { InjectedWallet } from "./InjectedWallet";
export { NearConnector } from "./NearConnector";
export type { NearConnectorOptions } from "./NearConnector";

export { nearActionsToConnectorActions } from "./actions";
export type { ConnectorAction } from "./actions/types";
export type { WalletPlugin } from "./types/plugin";

export type {
  FooterBranding,
  NearWalletBase,
  WalletManifest,
  EventNearWalletInjected,
  SignMessageParams,
  SignedMessage,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignDelegateActionsParams,
  NearConnector_ConnectOptions,
  SignInAndSignMessageParams,
  Account,
  AccountWithSignedMessage,
  EventMap,
  EventType,
  AddFunctionCallKeyParams,
  AddFunctionCallKey_AllowMethods,
  AddFunctionCallKey_GasAllowance,
} from "./types";
