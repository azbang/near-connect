import {
  Account,
  FinalExecutionOutcome,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignedMessage,
  SignMessageParams,
  WalletManifest,
} from "../types";
import { NearConnector } from "../NearConnector";
import { nearActionsToConnectorActions } from "../actions";
import SandboxExecutor from "./executor";

export class SandboxWallet {
  executor: SandboxExecutor;

  constructor(readonly connector: NearConnector, readonly manifest: WalletManifest) {
    this.executor = new SandboxExecutor(connector, manifest);
  }

  async signIn(data?: { network?: Network; contractId?: string; methodNames?: Array<string> }): Promise<Array<Account>> {
    return this.executor.call("wallet:signIn", {
      network: data?.network || this.connector.network,
      contractId: data?.contractId,
      methodNames: data?.methodNames,
    });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    const args = { ...data, network: data?.network || this.connector.network };
    await this.executor.call("wallet:signOut", args);
    await this.executor.clearStorage();
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    const args = { ...data, network: data?.network || this.connector.network };
    return this.executor.call("wallet:getAccounts", args);
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const actions = nearActionsToConnectorActions(params.actions);
    const args = { ...params, actions, network: params.network || this.connector.network };
    return this.executor.call("wallet:signAndSendTransaction", args);
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const transactions = params.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));

    const args = { ...params, transactions, network: params.network || this.connector.network };
    return this.executor.call("wallet:signAndSendTransactions", args);
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const args = { ...params, network: params.network || this.connector.network };
    return this.executor.call("wallet:signMessage", args);
  }
}

export default SandboxWallet;
