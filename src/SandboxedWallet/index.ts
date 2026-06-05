import {
  Account,
  FinalExecutionOutcome,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignDelegateActionsParams,
  SignedMessage,
  SignMessageParams,
  WalletManifest,
  SignDelegateActionsResponse,
  type AccountWithSignedMessage,
  type SignInAndSignMessageParams,
  type SignInParams,
  type ResolveAuthParams,
  type ResolveAuthResponse,
} from "../types";
import { NearConnector } from "../NearConnector";
import { nearActionsToConnectorActions } from "../actions";
import {
  defaultResolveAuthViaSignMessage,
  isResolveAuthMethodNotFound,
  polyfillSignInAndSignMessage,
} from "../helpers/resolveAuth";
import SandboxExecutor from "./executor";

export class SandboxWallet {
  executor: SandboxExecutor;

  constructor(
    readonly connector: NearConnector,
    readonly manifest: WalletManifest,
  ) {
    this.executor = new SandboxExecutor(connector, manifest);
  }

  async signIn(data?: SignInParams): Promise<Array<Account>> {
    return this.executor.call("wallet:signIn", {
      network: data?.network ?? this.connector.network,
      addFunctionCallKey: data?.addFunctionCallKey,
    });
  }

  async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<Array<AccountWithSignedMessage>> {
    const network = data?.network ?? this.connector.network;
    if (this.manifest.features?.signInAndSignMessage === true) {
      return this.executor.call("wallet:signInAndSignMessage", {
        network,
        addFunctionCallKey: data?.addFunctionCallKey,
        messageParams: data.messageParams,
      });
    }
    return polyfillSignInAndSignMessage(this, { ...data, network });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    const args = { ...data, network: data?.network ?? this.connector.network };
    await this.executor.call("wallet:signOut", args);
    await this.executor.clearStorage();
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    const args = { ...data, network: data?.network ?? this.connector.network };
    return this.executor.call("wallet:getAccounts", args);
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const actions = nearActionsToConnectorActions(params.actions);
    const args = { ...params, actions, network: params.network ?? this.connector.network };
    return this.executor.call("wallet:signAndSendTransaction", args);
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const transactions = params.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));

    const args = { ...params, transactions, network: params.network ?? this.connector.network };
    return this.executor.call("wallet:signAndSendTransactions", args);
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const args = { ...params, network: params.network ?? this.connector.network };
    return this.executor.call("wallet:signMessage", args);
  }

  async signDelegateActions(params: SignDelegateActionsParams): Promise<SignDelegateActionsResponse> {
    const args = {
      ...params,
      delegateActions: params.delegateActions.map((delegateAction) => ({
        ...delegateAction,
        actions: nearActionsToConnectorActions(delegateAction.actions),
      })),
      network: params.network ?? this.connector.network,
    };
    return this.executor.call("wallet:signDelegateActions", args);
  }

  async resolveAuth(params: ResolveAuthParams): Promise<ResolveAuthResponse> {
    const args = { ...params, network: params.network ?? this.connector.network };
    if (this.manifest.features?.resolveAuth === true) {
      try {
        return await this.executor.call("wallet:resolveAuth", args);
      } catch (e) {
        // Manifest may advertise `resolveAuth: true` for a wallet that hasn't
        // implemented it natively — that's the signal that the default
        // signMessage-based fallback is acceptable. Only swallow the specific
        // "method not found" signal; any other error is a real failure.
        if (!isResolveAuthMethodNotFound(e)) throw e;
      }
    }
    return defaultResolveAuthViaSignMessage(this, args);
  }
}

export default SandboxWallet;
