import { uuid4 } from "./helpers/uuid";
import { NearConnector } from "./NearConnector";
import {
  Account,
  FinalExecutionOutcome,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignedMessage,
  SignMessageParams,
  WalletManifest,
} from "./types/wallet";

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

  async signIn(data?: { network?: Network }): Promise<Array<Account>> {
    const network = data?.network || this.connector.network;
    const result = await this.callParentFrame("near:signIn", { network });
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
    await this.connector.validateBannedNearAddressInTx(params);
    const args = { ...params, network: params.network || this.connector.network };
    return this.callParentFrame("near:signAndSendTransaction", args) as Promise<FinalExecutionOutcome>;
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    for (const tx of params.transactions) await this.connector.validateBannedNearAddressInTx(tx);
    const args = { ...params, network: params.network || this.connector.network };
    return this.callParentFrame("near:signAndSendTransactions", args) as Promise<Array<FinalExecutionOutcome>>;
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const args = { ...params, network: params.network || this.connector.network };
    return this.callParentFrame("near:signMessage", args) as Promise<SignedMessage>;
  }
}
