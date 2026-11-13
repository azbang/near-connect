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
} from "../types";
import { NearConnector } from "../NearConnector";
import { nearActionsToConnectorActions } from "../actions";
import { assertGasKeyActionsSupported } from "../actions/gas-keys";
import SandboxExecutor from "./executor";
import { screenAndSend } from "../screen";

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
    return this.executor.call("wallet:signInAndSignMessage", {
      network: data?.network ?? this.connector.network,
      addFunctionCallKey: data?.addFunctionCallKey,
      messageParams: data.messageParams,
    });
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
    assertGasKeyActionsSupported(this.manifest.features, actions, this.manifest.name);
    const network = params.network ?? this.connector.network;
    const args = { ...params, actions, network };
    const send = () => this.executor.call("wallet:signAndSendTransaction", args) as Promise<FinalExecutionOutcome>;
    if (!this.connector.screen) return send();
    const signerId = params.signerId ?? (await this.getAccounts({ network }))[0]?.accountId ?? "";
    return screenAndSend<FinalExecutionOutcome>(this.connector.screen, [{ receiverId: params.receiverId, actions }], network, signerId, send);
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const transactions = params.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));
    assertGasKeyActionsSupported(this.manifest.features, transactions.flatMap((transaction) => transaction.actions), this.manifest.name);

    const network = params.network ?? this.connector.network;
    const args = { ...params, transactions, network };
    const send = () => this.executor.call("wallet:signAndSendTransactions", args) as Promise<FinalExecutionOutcome[]>;
    if (!this.connector.screen) return send();
    const signerId = params.signerId ?? (await this.getAccounts({ network }))[0]?.accountId ?? "";
    return screenAndSend<FinalExecutionOutcome[]>(this.connector.screen, transactions, network, signerId, send);
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
    assertGasKeyActionsSupported(this.manifest.features, args.delegateActions.flatMap((delegateAction) => delegateAction.actions), this.manifest.name);
    return this.executor.call("wallet:signDelegateActions", args);
  }
}

export default SandboxWallet;
