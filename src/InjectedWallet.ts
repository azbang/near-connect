import {
  Account,
  FinalExecutionOutcome,
  NearWalletBase,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignDelegateActionsParams,
  SignDelegateActionsResponse,
  SignedMessage,
  SignMessageParams,
  type AccountWithSignedMessage,
  type ResolveAuthParams,
  type ResolveAuthResponse,
  type SignInAndSignMessageParams,
  type SignInParams,
} from "./types";
import { NearConnector } from "./NearConnector";
import { nearActionsToConnectorActions } from "./actions";
import {
  defaultResolveAuthViaSignMessage,
  isResolveAuthMethodNotFound,
  polyfillSignInAndSignMessage,
} from "./helpers/resolveAuth";

export class InjectedWallet implements NearWalletBase {
  constructor(
    readonly connector: NearConnector,
    readonly wallet: NearWalletBase,
  ) {}

  get manifest() {
    return this.wallet.manifest;
  }

  async signIn({ addFunctionCallKey, network }: SignInParams): Promise<Array<Account>> {
    return this.wallet.signIn({
      network: network ?? this.connector.network,
      addFunctionCallKey,
    });
  }

  async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<Array<AccountWithSignedMessage>> {
    const network = data?.network ?? this.connector.network;
    if (this.manifest.features?.signInAndSignMessage === true) {
      return this.wallet.signInAndSignMessage({
        network,
        addFunctionCallKey: data.addFunctionCallKey,
        messageParams: data.messageParams,
      });
    }
    return polyfillSignInAndSignMessage(this, { ...data, network });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    await this.wallet.signOut({ network: data?.network ?? this.connector.network });
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    return this.wallet.getAccounts({ network: data?.network ?? this.connector.network });
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const actions = nearActionsToConnectorActions(params.actions);
    const network = params.network ?? this.connector.network;

    const result = await this.wallet.signAndSendTransaction({ ...params, actions, network });
    if (!result) throw new Error("No result from wallet");

    // @ts-ignore
    if (Array.isArray(result.transactions)) return result.transactions[0];
    return result;
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const network = params.network ?? this.connector.network;
    const transactions = params.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));

    const result = await this.wallet.signAndSendTransactions({ ...params, transactions, network });
    if (!result) throw new Error("No result from wallet");

    // @ts-ignore
    if (Array.isArray(result.transactions)) return result.transactions;
    return result;
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    return this.wallet.signMessage({ ...params, network: params.network ?? this.connector.network });
  }

  async signDelegateActions(params: SignDelegateActionsParams): Promise<SignDelegateActionsResponse> {
    return this.wallet.signDelegateActions({
      ...params,
      delegateActions: params.delegateActions.map((delegateAction) => ({
        ...delegateAction,
        actions: nearActionsToConnectorActions(delegateAction.actions),
      })),
      network: params.network ?? this.connector.network,
    });
  }

  async resolveAuth(params: ResolveAuthParams): Promise<ResolveAuthResponse> {
    const args = { ...params, network: params.network ?? this.connector.network };
    if (this.manifest.features?.resolveAuth === true && this.wallet.resolveAuth) {
      try {
        return await this.wallet.resolveAuth(args);
      } catch (e) {
        // See SandboxedWallet.resolveAuth — fall through to the default
        // signMessage-based impl when the injected wallet reports the
        // method isn't implemented.
        if (!isResolveAuthMethodNotFound(e)) throw e;
      }
    }
    return defaultResolveAuthViaSignMessage(this, args);
  }
}
