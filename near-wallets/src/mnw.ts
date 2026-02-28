import { serialize as borshSerialize } from "borsh";
import {
  privateKeyFromRandom, publicKeyFromPrivate, signHash, sha256,
  bytesToBase64, mapTransaction, SCHEMA,
} from "@fastnear/utils";
import type { PlainTransaction } from "@fastnear/utils";

import { NearRpc } from "./utils/rpc";
import { connectorActionsToFastnearActions } from "./utils/action";
import type { ConnectorAction } from "./utils/action";

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

  getPublicKey(): string | undefined {
    if (this.functionCallKey) return publicKeyFromPrivate(this.functionCallKey.privateKey);
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
    // Clear per-contract function call keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("functionCallKey:")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
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
      const privateKey = privateKeyFromRandom();
      const publicKey = publicKeyFromPrivate(privateKey);
      newUrl.searchParams.set("public_key", publicKey);
      this.functionCallKey = { privateKey, contractId, methods: methodNames || [] };
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
    href.searchParams.append("nonce", bytesToBase64(new Uint8Array(nonce)));
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

  async signAndSendTransactions(transactionsWS: Array<{ actions: Array<any>; receiverId: string }>, signerId?: string): Promise<Array<any>> {
    const accountId = signerId || window.localStorage.getItem("signedAccountId") || this.signedAccountId;
    const txs = await Promise.all(transactionsWS.map((t) => this.completeTransaction({ signerId: accountId, receiverId: t.receiverId, actions: t.actions })));
    return this.signAndSendTransactionsMNW(txs);
  }

  async signAndSendTransaction({ signerId, receiverId, actions }: { signerId?: string; receiverId: string; actions: Array<any> }): Promise<any> {
    const accountId = signerId || window.localStorage.getItem("signedAccountId") || this.signedAccountId;
    const key = this.getKeyForContract(receiverId);
    if (actions.length === 1 && key && this.keyCanSign(key, actions)) {
      try {
        return await this.signUsingKeyPair({ signerId: accountId, receiverId, actions, key });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("Failed to sign using key pair, falling back to wallet", error);
      }
    }

    const tx = await this.completeTransaction({ signerId: accountId, receiverId, actions });
    const results = await this.signAndSendTransactionsMNW([tx]);
    return results[0];
  }

  async completeTransaction({ signerId, receiverId, actions }: { signerId?: string; receiverId: string; actions: Array<any> }): Promise<PlainTransaction> {
    const signedAccountId = signerId || window.localStorage.getItem("signedAccountId") || this.signedAccountId;
    const block = await this.provider.block({ finality: "final" });
    return {
      signerId: signedAccountId,
      publicKey: publicKeyFromPrivate(privateKeyFromRandom()),
      nonce: 0,
      receiverId,
      blockHash: block.header.hash,
      actions,
    };
  }

  async signAndSendTransactionsMNW(txs: Array<PlainTransaction>): Promise<Array<any>> {
    const url = this.requestSignTransactionsUrl(txs);
    const txsHashes = (await this.handlePopupTransaction(url, (data) => data.transactionHashes))?.split(",");
    if (!txsHashes) throw new Error("No transaction hashes received");
    return Promise.all(txsHashes.map((hash) => this.provider.txStatus(hash, "unused", "NONE")));
  }

  getKeyForContract(receiverId: string): FunctionCallKey | null {
    // New per-contract format first
    const raw = window.localStorage.getItem(`functionCallKey:${receiverId}`);
    if (raw) return { ...JSON.parse(raw), contractId: receiverId };
    // Legacy fallback
    if (this.functionCallKey && this.functionCallKey.contractId === receiverId) return this.functionCallKey;
    return null;
  }

  keyCanSign(key: FunctionCallKey, actions: Array<any>): boolean {
    const action = actions[0];
    return !!(
      action.type === "FunctionCall" &&
      (action.deposit === "0" || action.deposit === undefined) &&
      (key.methods.length === 0 || key.methods.includes(action.methodName))
    );
  }

  async signUsingKeyPair({ signerId, receiverId, actions, key }: { signerId?: string; receiverId: string; actions: Array<any>; key: FunctionCallKey }): Promise<any> {
    const signedAccountId = signerId || window.localStorage.getItem("signedAccountId") || this.signedAccountId;
    const publicKey = publicKeyFromPrivate(key.privateKey);

    // Look up access key nonce from RPC
    const accessKeyInfo: any = await this.provider.query({
      request_type: "view_access_key",
      account_id: signedAccountId,
      public_key: publicKey,
      finality: "optimistic",
    });
    const nonce = BigInt(accessKeyInfo.nonce) + 1n;

    // Get recent block hash
    const block = await this.provider.block({ finality: "final" });

    // Build plain transaction and map for borsh serialization
    const plainTx: PlainTransaction = {
      signerId: signedAccountId, publicKey, nonce, receiverId,
      blockHash: block.header.hash,
      actions,
    };
    const mappedTx = mapTransaction(plainTx);

    // Sign: hash the borsh-serialized transaction, sign with private key
    const serializedTx = borshSerialize(SCHEMA.Transaction, mappedTx);
    const txHash = sha256(serializedTx);
    const signatureBytes = signHash(txHash, key.privateKey) as Uint8Array;

    // Submit signed transaction directly via RPC
    const signedTxBytes = borshSerialize(SCHEMA.SignedTransaction, {
      transaction: mappedTx,
      signature: { ed25519Signature: { data: signatureBytes } },
    });

    return this.provider.sendJsonRpc("send_tx", {
      signed_tx_base64: bytesToBase64(new Uint8Array(signedTxBytes)),
      wait_until: "EXECUTED_OPTIMISTIC",
    });
  }

  requestSignTransactionsUrl(txs: Array<PlainTransaction>): string {
    const newUrl = new URL("sign", this.walletUrl);
    newUrl.searchParams.set(
      "transactions",
      txs
        .map((tx) => borshSerialize(SCHEMA.Transaction, mapTransaction(tx)))
        .map((serialized) => bytesToBase64(new Uint8Array(serialized)))
        .join(",")
    );

    newUrl.searchParams.set("callbackUrl", new URL(window.selector.location).toString());
    return newUrl.toString();
  }

  async handlePopupTransaction<T>(url: string, callback: (result: WalletMessage) => T): Promise<T> {
    const left = Math.round(window.screenX + (window.outerWidth - DEFAULT_POPUP_WIDTH) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - DEFAULT_POPUP_HEIGHT) / 2);

    const childWindow = window.selector.open(url, "MyNearWallet", `width=${DEFAULT_POPUP_WIDTH},height=${DEFAULT_POPUP_HEIGHT},top=${top},left=${left},scrollbars=yes,resizable=yes`);

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

    async signAndSendTransaction({ signerId, receiverId, actions, network }: { signerId?: string; receiverId: string; actions: Array<ConnectorAction>; network: string }) {
      if (!wallet[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallet[network].signAndSendTransaction({ signerId, receiverId, actions: connectorActionsToFastnearActions(actions) });
    },

    async signAndSendTransactions({ signerId, transactions, network }: { signerId?: string; transactions: { receiverId: string; actions: ConnectorAction[] }[]; network: string }) {
      if (!wallet[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallet[network].signAndSendTransactions(
        transactions.map((t) => ({
          actions: connectorActionsToFastnearActions(t.actions),
          receiverId: t.receiverId,
        })),
        signerId,
      );
    },

    async generateFunctionCallKey({ contractId, methodNames, network }: { contractId: string; methodNames: string[]; network: string }) {
      if (!wallet[network].isSignedIn()) throw new Error("Wallet not signed in");
      const privateKey = privateKeyFromRandom();
      const publicKey = publicKeyFromPrivate(privateKey);
      // Store tentatively with a pending prefix
      window.localStorage.setItem(
        `pendingFunctionCallKey:${publicKey}`,
        JSON.stringify({ privateKey, contractId, methods: methodNames || [] }),
      );
      return { publicKey };
    },

    async confirmFunctionCallKey({ publicKey, network }: { publicKey: string; network: string }) {
      const raw = window.localStorage.getItem(`pendingFunctionCallKey:${publicKey}`);
      if (!raw) throw new Error("No pending function call key found for this public key");
      const { privateKey, contractId, methods } = JSON.parse(raw);
      // Write to per-contract key
      window.localStorage.setItem(`functionCallKey:${contractId}`, JSON.stringify({ privateKey, methods }));
      // Update the in-memory legacy key as well so keyCanSign works immediately
      wallet[network].functionCallKey = { privateKey, contractId, methods };
      // Clean up pending
      window.localStorage.removeItem(`pendingFunctionCallKey:${publicKey}`);
    },

    async removeFunctionCallKey({ publicKey }: { publicKey: string }) {
      window.localStorage.removeItem(`pendingFunctionCallKey:${publicKey}`);
    },
  };
};

MyNearWallet().then((wallet) => {
  window.selector.ready(wallet);
});
