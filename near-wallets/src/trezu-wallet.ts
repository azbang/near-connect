import type { ConnectorAction } from "./utils/action";
import type { SignInParams } from "./utils/types";

const DEFAULT_POPUP_WIDTH = 520;
const DEFAULT_POPUP_HEIGHT = 700;
const POLL_INTERVAL = 300;

const TREZU_URLS: Record<string, string> = {
  mainnet: "http://localhost:3000",
  testnet: "http://localhost:3000",
};

const RPC_URLS: Record<string, string> = {
  mainnet: "https://rpc.mainnet.near.org",
  testnet: "https://rpc.testnet.near.org",
};

async function txStatus(rpcUrl: string, txHash: string, signerId: string): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tx",
      params: { tx_hash: txHash, sender_account_id: signerId, wait_until: "NONE" },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

interface WalletMessage {
  type: string;
  status?: "success" | "failure";
  accountId?: string;
  publicKey?: string;
  transactionHashes?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

class TrezuWalletConnector {
  walletUrl: string;
  signedAccountId: string;
  network: string;

  constructor(walletUrl: string, network: string) {
    this.walletUrl = walletUrl;
    this.signedAccountId = window.localStorage.getItem("trezu:signedAccountId") || "";
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
    window.localStorage.removeItem("trezu:signedAccountId");
  }

  async requestSignIn(): Promise<Array<{ accountId: string; publicKey: string }>> {
    const url = new URL(`${this.walletUrl}/wallet`);
    url.searchParams.set("action", "sign_in");
    url.searchParams.set("network", this.network);
    url.searchParams.set("callbackUrl", window.selector.location);

    return await this.handlePopup(url.toString(), (data) => {
      const accountId = data.accountId;
      if (accountId) {
        this.signedAccountId = accountId;
        window.localStorage.setItem("trezu:signedAccountId", accountId);
        return [{ accountId, publicKey: data.publicKey || "" }];
      }
      throw new Error("Invalid response from Trezu Wallet");
    });
  }

  async signAndSendTransactions(
    transactions: Array<{ receiverId: string; actions: ConnectorAction[] }>
  ): Promise<any[]> {
    const url = new URL(`${this.walletUrl}/wallet`);
    url.searchParams.set("action", "sign_transactions");
    url.searchParams.set("network", this.network);
    url.searchParams.set("callbackUrl", window.selector.location);
    url.searchParams.set("transactions", btoa(JSON.stringify(transactions)));
    url.searchParams.set("signerId", this.signedAccountId);

    return await this.handlePopup(url.toString(), async (data) => {
      if (data.transactionHashes) {
        const hashes = data.transactionHashes.split(",");
        const rpcUrl = RPC_URLS[this.network] || RPC_URLS.mainnet;
        const outcomes = await Promise.all(
          hashes.map((hash: string) => txStatus(rpcUrl, hash, this.signedAccountId))
        );
        return outcomes;
      }
      return [];
    });
  }

  async signAndSendTransaction(params: {
    receiverId: string;
    actions: ConnectorAction[];
  }): Promise<any> {
    const results = await this.signAndSendTransactions([params]);
    return results[0];
  }

  private async handlePopup<T>(url: string, callback: (result: WalletMessage) => T | Promise<T>): Promise<T> {
    const screenWidth = window.innerWidth || screen.width;
    const screenHeight = window.innerHeight || screen.height;
    const left = (screenWidth - DEFAULT_POPUP_WIDTH) / 2;
    const top = (screenHeight - DEFAULT_POPUP_HEIGHT) / 2;

    const childWindow = window.selector.open(
      url,
      "TrezuWallet",
      `width=${DEFAULT_POPUP_WIDTH},height=${DEFAULT_POPUP_HEIGHT},top=${top},left=${left}`
    );

    const id = await childWindow.windowIdPromise;
    if (!id) {
      await window.selector.ui.whenApprove({ title: "Request action", button: "Open Trezu Wallet" });
      return await this.handlePopup(url, callback);
    }

    return new Promise<T>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const message = event.data as WalletMessage;
        if (!message || !message.type || !message.type.startsWith("trezu:")) return;

        if (message.type === "trezu:result") {
          if (message.status === "success") {
            window.removeEventListener("message", handler);
            childWindow.close();
            Promise.resolve(callback(message)).then(resolve, reject);
          } else if (message.status === "failure") {
            window.removeEventListener("message", handler);
            childWindow.close();
            reject(new Error(message.errorMessage || "Operation failed"));
          }
        }
      };

      window.addEventListener("message", handler);

      const intervalId = setInterval(() => {
        if (childWindow.closed) {
          window.removeEventListener("message", handler);
          clearInterval(intervalId);
          reject(new Error("User closed the window"));
        }
      }, POLL_INTERVAL);
    });
  }
}

const wallets: Record<string, TrezuWalletConnector> = {
  mainnet: new TrezuWalletConnector(TREZU_URLS.mainnet, "mainnet"),
  testnet: new TrezuWalletConnector(TREZU_URLS.testnet, "testnet"),
};

const TrezuWallet = async () => {
  const getAccounts = async (network: string) => {
    const accountId = wallets[network].getAccountId();
    return [{ accountId, publicKey: "" }];
  };

  return {
    async signIn({ network }: SignInParams) {
      if (!wallets[network].isSignedIn()) {
        await wallets[network].requestSignIn();
      }
      return getAccounts(network);
    },

    async signOut({ network }: { network: string }) {
      wallets[network].signOut();
    },

    async getAccounts({ network }: { network: string }) {
      return getAccounts(network);
    },

    async verifyOwner() {
      throw new Error("Method not supported by Trezu Wallet");
    },

    async signMessage() {
      throw new Error("Method not supported by Trezu Wallet");
    },

    async signAndSendTransaction({
      receiverId,
      actions,
      network,
    }: {
      receiverId: string;
      actions: ConnectorAction[];
      network: string;
    }) {
      if (!wallets[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallets[network].signAndSendTransaction({ receiverId, actions });
    },

    async signAndSendTransactions({
      transactions,
      network,
    }: {
      transactions: { receiverId: string; actions: ConnectorAction[] }[];
      network: string;
    }) {
      if (!wallets[network].isSignedIn()) throw new Error("Wallet not signed in");
      return wallets[network].signAndSendTransactions(transactions);
    },
  };
};

TrezuWallet().then((wallet) => {
  window.selector.ready(wallet);
});
