import { Account, FinalExecutionOutcome, NearWalletBase, Network, SignAndSendTransactionParams, SignAndSendTransactionsParams, SignDelegateActionsParams, SignDelegateActionsResponse, SignedMessage, SignMessageParams, type AccountWithSignedMessage, type ResolveAuthParams, type ResolveAuthResponse, type SignInAndSignMessageParams, type SignInParams } from "./types";
import { NearConnector } from "./NearConnector";
export declare class InjectedWallet implements NearWalletBase {
    readonly connector: NearConnector;
    readonly wallet: NearWalletBase;
    constructor(connector: NearConnector, wallet: NearWalletBase);
    get manifest(): import("./types").WalletManifest;
    signIn({ addFunctionCallKey, network }: SignInParams): Promise<Array<Account>>;
    signInAndSignMessage(data: SignInAndSignMessageParams): Promise<Array<AccountWithSignedMessage>>;
    signOut(data?: {
        network?: Network;
    }): Promise<void>;
    getAccounts(data?: {
        network?: Network;
    }): Promise<Array<Account>>;
    signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome>;
    signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>>;
    signMessage(params: SignMessageParams): Promise<SignedMessage>;
    signDelegateActions(params: SignDelegateActionsParams): Promise<SignDelegateActionsResponse>;
    resolveAuth(params: ResolveAuthParams): Promise<ResolveAuthResponse>;
}
