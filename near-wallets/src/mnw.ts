import { createTransaction, Transaction } from "@near-js/transactions";
import { Action, SCHEMA } from "@near-js/transactions";
import { FinalExecutionOutcome } from "@near-js/types";
import { KeyPair } from "@near-js/crypto";
import { baseDecode } from "@near-js/utils";
import * as borsh from "borsh";

import { NearRpc } from "./utils/rpc";
import { connectorActionsToNearActions, ConnectorAction } from "./utils/action";
import type { SignInParams, SignInAndSignMessageParams, AccountWithSignedMessage } from "./utils/types";

const DEFAULT_POPUP_WIDTH = 480;
const DEFAULT_POPUP_HEIGHT = 640;
const POLL_INTERVAL = 300;

interface WalletMessage {
  status: "success" | "failure" | "pending";
  transactionHashes?: string;
  signedRequest?: any;
  errorMessage?: string;
  errorCode?: string;
  error?: string;
  [key: string]: unknown;
}

interface WalletResponseData extends WalletMessage {
  public_key?: string;
  account_id: string;
}

interface Network {
  networkId: "mainnet" | "testnet";
  nodeUrl: string;
  helperUrl: string;
  explorerUrl: string;
  indexerUrl: string;
}

export class MyNearWalletConnector {
  walletUrl: string;
  signedAccountId: string;
  provider: NearRpc;
  network: Network;

  constructor(walletUrl: string, network: Network) {
    this.walletUrl = walletUrl;
    this.provider = new NearRpc(window.selector?.providers?.[network.networkId as "mainnet" | "testnet"] || [network.nodeUrl]);
    this.signedAccountId = window.localStorage.getItem("signedAccountId") || "";
    this.network = network;
  }

  getAccountId(): string {
    return this.signedAccountId;
  }

  isSignedIn(): boolean {
    return !!this.signedAccountId;
  }

  signOut(): void {
    this.signedAccountId = "";
    window.localStorage.removeItem("signedAccountId");
  }

  async requestSignIn({
    contractId,
    methodNames,
    publicKey,
  }: {
    contractId?: string;
    methodNames?: Array<string>;
    publicKey?: string;
  }): Promise<Array<{ accountId: string; publicKey: string }>> {
    const url = await this.requestSignInUrl({ contractId, methodNames, publicKey });

    return await this.handlePopupTransaction(url, async (data) => {
      const responseData = data as WalletResponseData;
      const { public_key: respPublicKey, account_id: accountId } = responseData;

      if (accountId) {
        this.signedAccountId = accountId;
        window.localStorage.setItem("signedAccountId", accountId);
        return [{ accountId, publicKey: respPublicKey || "" }];
      }

      throw new Error("Invalid response data from wallet");
    });
  }

  async requestSignInUrl({
    contractId,
    methodNames,
    publicKey,
  }: {
    contractId?: string;
    methodNames?: Array<string>;
    publicKey?: string;
  }): Promise<string> {
    const currentUrl = new URL(window.selector.location);

    const newUrl = new URL(`${this.walletUrl}/login/`);
    newUrl.searchParams.set("success_url", currentUrl.href);
    newUrl.searchParams.set("failure_url", currentUrl.href);

    if (contractId) {
      newUrl.searchParams.set("contract_id", contractId);
      if (publicKey) {
        newUrl.searchParams.set("public_key", publicKey);
      }
    }

    if (methodNames) {
      methodNames.forEach((methodName) => {
        newUrl.searchParams.append("methodNames", methodName);
      });
    }

    return newUrl.toString();
  }

  async signMessage({ message, nonce, recipient, callbackUrl, state }: any) {
    const url = callbackUrl || window.selector.location;
    if (!url) throw new Error(`MyNearWallet: CallbackUrl is missing`);

    const href = new URL(this.walletUrl);
    href.pathname = "sign-message";
    href.searchParams.append("message", message);
    href.searchParams.append("nonce", Buffer.from(nonce).toString("base64"));
    href.searchParams.append("recipient", recipient);
    href.searchParams.append("callbackUrl", url);
    if (state) href.searchParams.append("state", state);

    return await this.handlePopupTransaction(href.toString(), (value) => {
      return {
        accountId: value?.signedRequest?.accountId || "",
        publicKey: value?.signedRequest?.publicKey || "",
        signature: value?.signedRequest?.signature || "",
      };
    });
  }

  async signAndSendTransactions(transactionsWS: Array<{ actions: Array<Action>; receiverId: string }>): Promise<Array<FinalExecutionOutcome>> {
    const txs = await Promise.all(transactionsWS.map((t) => this.completeTransaction({ receiverId: t.receiverId, actions: t.actions })));
    return this.signAndSendTransactionsMNW(txs);
  }

  async signAndSendTransaction({ receiverId, actions }: { receiverId: string; actions: Array<Action> }): Promise<FinalExecutionOutcome> {
    const tx = await this.completeTransaction({ receiverId, actions });
    const results = await this.signAndSendTransactionsMNW([tx]);
    return results[0];
  }

  async completeTransaction({ receiverId, actions }: { receiverId: string; actions: Array<Action> }): Promise<Transaction> {
    const block = await this.provider.block({ finality: "final" });
    const blockHash = baseDecode(block.header.hash);
    return createTransaction(this.signedAccountId, KeyPair.fromRandom("ed25519").getPublicKey(), receiverId, 0, actions, blockHash);
  }

  async signAndSendTransactionsMNW(txs: Array<Transaction>): Promise<Array<FinalExecutionOutcome>> {
    const url = this.requestSignTransactionsUrl(txs);
    const txsHashes = (await this.handlePopupTransaction(url, (data) => data.transactionHashes))?.split(",");
    if (!txsHashes) throw new Error("No transaction hashes received");
    return Promise.all(txsHashes.map((hash) => this.provider.txStatus(hash, "unused", "NONE")));
  }

  requestSignTransactionsUrl(txs: Array<Transaction>): string {
    const newUrl = new URL("sign", this.walletUrl);
    newUrl.searchParams.set(
      "transactions",
      txs
        .map((transaction) => borsh.serialize(SCHEMA.Transaction, transaction))
        .map((serialized) => Buffer.from(serialized).toString("base64"))
        .join(",")
    );

    newUrl.searchParams.set("callbackUrl", new URL(window.selector.location).toString());
    return newUrl.toString();
  }

  async handlePopupTransaction<T>(url: string, callback: (result: WalletMessage) => T): Promise<T> {
    const screenWidth = window.innerWidth || screen.width;
    const screenHeight = window.innerHeight || screen.height;
    const left = (screenWidth - DEFAULT_POPUP_WIDTH) / 2;
    const top = (screenHeight - DEFAULT_POPUP_HEIGHT) / 2;

    const childWindow = window.selector.open(url, "MyNearWallet", `width=${DEFAULT_POPUP_WIDTH},height=${DEFAULT_POPUP_HEIGHT},top=${top},left=${left}`);

    const id = await childWindow.windowIdPromise;
    if (!id) {
      await window.selector.ui.whenApprove({ title: "Request action", button: "Open wallet" });
      return await this.handlePopupTransaction(url, callback);
    }

    return new Promise<T>((resolve, reject) => {
      const messageHandler = this.setupMessageHandler(resolve, reject, childWindow, callback);

      const intervalId = setInterval(() => {
        if (childWindow.closed) {
          window.removeEventListener("message", messageHandler);
          clearInterval(intervalId);
          reject(new Error("User closed the window"));
        }
      }, POLL_INTERVAL);
    });
  }

  private setupMessageHandler<T>(
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
    childWindow: {
      close: () => void;
      postMessage: (message: any) => void;
      windowIdPromise: Promise<string | null>;
      closed: boolean;
    },
    callback: (result: WalletMessage) => T
  ): (event: MessageEvent) => Promise<void> {
    const handler = async (event: MessageEvent) => {
      const message = event.data as WalletMessage;
      if (message.method) return;

      switch (message.status) {
        case "success":
          childWindow?.close();
          resolve(callback(message));
          break;

        case "failure":
          childWindow?.close();
          reject(new Error(message.errorMessage || "Transaction failed"));
          break;

        default:
          // eslint-disable-next-line no-console
          console.warn("Unhandled message status:", message.status);
      }
    };

    window.addEventListener("message", handler);
    return handler;
  }
}

const wallet: Record<string, MyNearWalletConnector> = {
  mainnet: new MyNearWalletConnector("https://app.mynearwallet.com", {
    networkId: "mainnet",
    nodeUrl: "https://rpc.mainnet.near.org",
    helperUrl: "https://helper.mainnet.near.org",
    explorerUrl: "https://explorer.mainnet.near.org",
    indexerUrl: "https://indexer.mainnet.near.org",
  }),

  testnet: new MyNearWalletConnector("https://testnet.mynearwallet.com", {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
    indexerUrl: "https://indexer.testnet.near.org",
  }),
};

const MyNearWallet = async () => {
  const getAccounts = async (network: string) => {
    const accountId = wallet[network].getAccountId();
    return [{ accountId, publicKey: "" }];
  };

  return {
    async signIn({ addFunctionCallKey, network }: SignInParams) {
      if (!wallet[network].isSignedIn()) {
        const contractId = addFunctionCallKey?.contractId;
        const publicKey = addFunctionCallKey?.publicKey;
        const methodNames = addFunctionCallKey?.allowMethods?.anyMethod === false
          ? addFunctionCallKey.allowMethods.methodNames
          : undefined;
        await wallet[network].requestSignIn({ contractId, methodNames, publicKey });
      }

      return getAccounts(network);
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      const { network, addFunctionCallKey, messageParams } = data;
      if (!wallet[network].isSignedIn()) {
        const contractId = addFunctionCallKey?.contractId;
        const publicKey = addFunctionCallKey?.publicKey;
        const methodNames = addFunctionCallKey?.allowMethods?.anyMethod === false
          ? addFunctionCallKey.allowMethods.methodNames
          : undefined;
        await wallet[network].requestSignIn({ contractId, methodNames, publicKey });
      }

      const signedMessage = await wallet[network].signMessage({
        message: messageParams.message,
        recipient: messageParams.recipient,
        nonce: messageParams.nonce,
      });

      const accountId = wallet[network].getAccountId();
      return [{
        accountId,
        publicKey: signedMessage.publicKey || "",
        signedMessage: {
          accountId: signedMessage.accountId || accountId,
          publicKey: signedMessage.publicKey || "",
          signature: signedMessage.signature || "",
        },
      }];
    },

    async signOut({ network }: { network: string }) {
      wallet[network].signOut();
    },

    async getAccounts({ network }: { network: string }) {
      return getAccounts(network);
    },

    async verifyOwner() {
      throw new Error(`Method not supported by MyNearWallet`);
    },

    async signMessage({ message, nonce, recipient, callbackUrl, state: sgnState, network }: any) {
      return await wallet[network].signMessage({ message, nonce, recipient, callbackUrl, state: sgnState });
    },

    async signAndSendTransaction({ receiverId, actions, network }: { receiverId: string; actions: Array<ConnectorAction>; network: string }) {
      if (!wallet[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallet[network].signAndSendTransaction({ receiverId, actions: connectorActionsToNearActions(actions) });
    },

    async signAndSendTransactions({ transactions, network }: { transactions: { receiverId: string; actions: ConnectorAction[] }[]; network: string }) {
      if (!wallet[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallet[network].signAndSendTransactions(
        transactions.map((t) => ({
          actions: connectorActionsToNearActions(t.actions),
          receiverId: t.receiverId,
        }))
      );
    },
  };
};

MyNearWallet().then((wallet) => {
  window.selector.ready(wallet);
});
