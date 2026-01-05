import { createTransaction, Transaction } from "@near-js/transactions";
import { Account, Connection, InMemorySigner } from "near-api-js";
import { Action, SCHEMA } from "@near-js/transactions";
import { FinalExecutionOutcome } from "@near-js/types";
import { KeyPair, PublicKey } from "@near-js/crypto";
import { baseDecode } from "@near-js/utils";
import * as borsh from "borsh";

import { NearRpc } from "./utils/rpc";
import { connectorActionsToNearActions, ConnectorAction } from "./utils/action";

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

interface FunctionCallKey {
  privateKey: string;
  contractId: string;
  methods: Array<string>;
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
  functionCallKey: FunctionCallKey | null;
  provider: NearRpc;
  network: Network;

  constructor(walletUrl: string, network: Network) {
    // compatibility with old versions
    const walletAuthKey = window.localStorage.getItem("near_app_wallet_auth_key");

    if (walletAuthKey) {
      // Transform to the new format
      const { accountId } = JSON.parse(walletAuthKey);
      window.localStorage.setItem("signedAccountId", accountId);
      window.localStorage.removeItem("near_app_wallet_auth_key");

      // Check for access key in local storage
      const privateKey = window.localStorage.getItem(`near-api-js:keystore:${accountId}:${network.networkId}`);

      if (privateKey) {
        const { contractId, methodNames } = JSON.parse(window.localStorage.getItem("near-wallet-selector:contract") || "{}");

        this.functionCallKey = { privateKey: privateKey, contractId, methods: methodNames || [] };
        window.localStorage.setItem("functionCallKey", JSON.stringify(this.functionCallKey));
        window.localStorage.removeItem(`near-api-js:keystore:${accountId}:${network.networkId}`);
      }
    }

    this.walletUrl = walletUrl;
    this.provider = new NearRpc(window.selector?.providers?.[network.networkId as "mainnet" | "testnet"] || [network.nodeUrl]);
    this.signedAccountId = window.localStorage.getItem("signedAccountId") || "";

    const functionCallKey = window.localStorage.getItem("functionCallKey");
    this.functionCallKey = functionCallKey ? JSON.parse(functionCallKey) : null;
    this.network = network;
  }

  getAccountId(): string {
    return this.signedAccountId;
  }

  getPublicKey(): PublicKey | undefined {
    if (this.functionCallKey) return KeyPair.fromString(this.functionCallKey.privateKey as any).getPublicKey();
    return undefined;
  }

  isSignedIn(): boolean {
    return !!this.signedAccountId;
  }

  signOut(): void {
    this.signedAccountId = "";
    this.functionCallKey = null;
    window.localStorage.removeItem("signedAccountId");
    window.localStorage.removeItem("functionCallKey");
  }

  async requestSignIn({
    contractId,
    methodNames,
  }: {
    contractId?: string;
    methodNames?: Array<string>;
  }): Promise<Array<{ accountId: string; publicKey: string }>> {
    const url = await this.requestSignInUrl({ contractId, methodNames });

    return await this.handlePopupTransaction(url, async (data) => {
      const responseData = data as WalletResponseData;
      const { public_key: publicKey, account_id: accountId } = responseData;

      if (accountId) {
        this.signedAccountId = accountId;
        window.localStorage.setItem("signedAccountId", accountId);
        return [{ accountId, publicKey: publicKey || "" }];
      }

      throw new Error("Invalid response data from wallet");
    });
  }

  async requestSignInUrl({ contractId, methodNames }: { contractId?: string; methodNames?: Array<string> }): Promise<string> {
    const currentUrl = new URL(window.selector.location);

    const newUrl = new URL(`${this.walletUrl}/login/`);
    newUrl.searchParams.set("success_url", currentUrl.href);
    newUrl.searchParams.set("failure_url", currentUrl.href);

    if (contractId) {
      newUrl.searchParams.set("contract_id", contractId);
      const accessKey = KeyPair.fromRandom("ed25519");
      newUrl.searchParams.set("public_key", accessKey.getPublicKey().toString());
      this.functionCallKey = { privateKey: accessKey.toString(), contractId, methods: methodNames || [] };
      window.localStorage.setItem("functionCallKey", JSON.stringify(this.functionCallKey));
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
    if (actions.length === 1 && this.storedKeyCanSign(receiverId, actions)) {
      try {
        return this.signUsingKeyPair({ receiverId, actions });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("Failed to sign using key pair, falling back to wallet", error);
      }
    }

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

  storedKeyCanSign(receiverId: string, actions: Array<Action>) {
    if (this.functionCallKey && this.functionCallKey.contractId === receiverId) {
      return (
        actions[0].functionCall &&
        actions[0].functionCall.deposit.toString() === "0" &&
        (this.functionCallKey.methods.length === 0 || this.functionCallKey.methods.includes(actions[0].functionCall.methodName))
      );
    } else {
      return false;
    }
  }

  async signUsingKeyPair({ receiverId, actions }: { receiverId: string; actions: Array<Action> }): Promise<FinalExecutionOutcome> {
    // instantiate an account (NEAR API is a nightmare)
    const keyPair = KeyPair.fromString(this.functionCallKey!.privateKey as any);
    const signer = await InMemorySigner.fromKeyPair(this.network.networkId, this.signedAccountId, keyPair);
    const connection = new Connection(this.network.networkId, this.provider, signer, "");
    const account = new Account(connection, this.signedAccountId);
    return account.signAndSendTransaction({ receiverId, actions });
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
    const publicKey = wallet[network].getPublicKey();
    return [{ accountId, publicKey }];
  };

  return {
    async signIn({ contractId, methodNames, network }: any) {
      if (!wallet[network].isSignedIn()) {
        await wallet[network].requestSignIn({ contractId, methodNames });
      }

      return getAccounts(network);
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
