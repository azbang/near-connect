import {
  Account,
  FinalExecutionOutcome,
  NearWalletBase,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignedMessage,
  SignMessageParams,
} from "./types/wallet";
import { NearConnector } from "./NearConnector";

export class InjectedWallet {
  constructor(readonly connector: NearConnector, readonly wallet: NearWalletBase) {}

  get manifest() {
    return this.wallet.manifest;
  }

  async signIn(data?: { network?: Network }): Promise<Array<Account>> {
    const network = data?.network || this.connector.network;
    return this.wallet.signIn({ network });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    await this.wallet.signOut({ network: data?.network || this.connector.network });
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    return this.wallet.getAccounts({ network: data?.network || this.connector.network });
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    await this.connector.validateBannedNearAddressInTx(params);

    const network = params.network || this.connector.network;
    const result = await this.wallet.signAndSendTransaction({ ...params, network });
    if (!result) throw new Error("No result from wallet");

    // @ts-ignore
    if (Array.isArray(result.transactions)) return result.transactions[0];
    return result;
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    for (const tx of params.transactions) await this.connector.validateBannedNearAddressInTx(tx);
    const network = params.network || this.connector.network;
    const result = await this.wallet.signAndSendTransactions({ ...params, network });
    if (!result) throw new Error("No result from wallet");

    // @ts-ignore
    if (Array.isArray(result.transactions)) return result.transactions;
    return result;
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    return this.wallet.signMessage({ ...params, network: params.network || this.connector.network });
  }
}
