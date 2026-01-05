import {
  Account,
  FinalExecutionOutcome,
  NearWalletBase,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignedMessage,
  SignMessageParams,
} from "./types";
import { NearConnector } from "./NearConnector";
import { nearActionsToConnectorActions } from "./actions";

export class InjectedWallet {
  constructor(readonly connector: NearConnector, readonly wallet: NearWalletBase) {}

  get manifest() {
    return this.wallet.manifest;
  }

  async signIn(data?: { network?: Network; contractId?: string; methodNames?: Array<string> }): Promise<Array<Account>> {
    return this.wallet.signIn({
      network: data?.network || this.connector.network,
      contractId: data?.contractId,
      methodNames: data?.methodNames,
    });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    await this.wallet.signOut({ network: data?.network || this.connector.network });
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    return this.wallet.getAccounts({ network: data?.network || this.connector.network });
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const actions = nearActionsToConnectorActions(params.actions);
    const network = params.network || this.connector.network;

    const result = await this.wallet.signAndSendTransaction({ ...params, actions, network });
    if (!result) throw new Error("No result from wallet");

    // @ts-ignore
    if (Array.isArray(result.transactions)) return result.transactions[0];
    return result;
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const network = params.network || this.connector.network;
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
    return this.wallet.signMessage({ ...params, network: params.network || this.connector.network });
  }
}
