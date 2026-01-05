import { nearActionsToConnectorActions } from "./actions";
import { uuid4 } from "./helpers/uuid";
import { NearConnector } from "./NearConnector";
import {
  Account,
  FinalExecutionOutcome,
  Network,
  SignAndSendTransactionsParams,
  SignAndSendTransactionParams,
  SignedMessage,
  SignMessageParams,
  WalletManifest,
} from "./types";

export class ParentFrameWallet {
  constructor(readonly connector: NearConnector, readonly manifest: WalletManifest) {}

  callParentFrame(method: string, params: any) {
    const id = uuid4();
    window.parent.postMessage({ type: "near-wallet-injected-request", id, method, params }, "*");

    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === "near-wallet-injected-response" && event.data.id === id) {
          window.removeEventListener("message", handler);
          if (event.data.success) resolve(event.data.result);
          else reject(event.data.error);
        }
      };

      window.addEventListener("message", handler);
    });
  }

  async signIn(data?: { network?: Network; contractId?: string; methodNames?: Array<string> }): Promise<Array<Account>> {
    const result = await this.callParentFrame("near:signIn", {
      network: data?.network || this.connector.network,
      contractId: data?.contractId,
      methodNames: data?.methodNames,
    });

    if (Array.isArray(result)) return result;
    return [result as Account];
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    const args = { ...data, network: data?.network || this.connector.network };
    await this.callParentFrame("near:signOut", args);
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    const args = { ...data, network: data?.network || this.connector.network };
    return this.callParentFrame("near:getAccounts", args) as Promise<Array<Account>>;
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const connectorActions = nearActionsToConnectorActions(params.actions);
    const args = { ...params, actions: connectorActions, network: params.network || this.connector.network };
    return this.callParentFrame("near:signAndSendTransaction", args) as Promise<FinalExecutionOutcome>;
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const args = { ...params, network: params.network || this.connector.network };
    args.transactions = args.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));

    return this.callParentFrame("near:signAndSendTransactions", args) as Promise<Array<FinalExecutionOutcome>>;
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const args = { ...params, network: params.network || this.connector.network };
    return this.callParentFrame("near:signMessage", args) as Promise<SignedMessage>;
  }
}
