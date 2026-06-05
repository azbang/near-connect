import { NearConnector } from "./NearConnector";
import { Account, FinalExecutionOutcome, Network, SignAndSendTransactionsParams, SignAndSendTransactionParams, SignedMessage, SignMessageParams, WalletManifest, SignDelegateActionsParams, SignDelegateActionsResponse, type AccountWithSignedMessage, type ResolveAuthParams, type ResolveAuthResponse, type SignInAndSignMessageParams, type SignInParams } from "./types";
export declare class ParentFrameWallet {
    readonly connector: NearConnector;
    readonly manifest: WalletManifest;
    constructor(connector: NearConnector, manifest: WalletManifest);
    callParentFrame(method: string, params: any): Promise<unknown>;
    signIn(data?: SignInParams): Promise<Array<Account>>;
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
