import SignClient from "@walletconnect/sign-client";
import { serialize as borshSerialize, deserialize as borshDeserialize } from "borsh";
import { base64Encode, mapTransaction, SCHEMA } from "near-api-js";
import type { PlainTransaction } from "near-api-js";
import { NearRpc } from "./utils/rpc";
import { connectorActionsToFastnearActions } from "./utils/action";
import type { ConnectorAction, AddKeyAction } from "./utils/action";
import { createQRSvg } from "./utils/qr";
import type { SignInParams, SignInAndSignMessageParams, AccountWithSignedMessage, AddFunctionCallKeyParams } from "./utils/types";

const WC_METHODS = ["near_signIn", "near_signOut", "near_getAccounts", "near_signTransaction", "near_signTransactions", "near_signMessage"];
const WC_EVENTS = ["chainChanged", "accountsChanged"];

const provider = new NearRpc(window.selector?.providers?.mainnet);

interface RetryOptions {
  retries?: number;
  interval?: number;
}

const timeout = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const retry = <Value>(func: () => Promise<Value>, opts: RetryOptions = {}): Promise<Value> => {
  const { retries = 5, interval = 500 } = opts;
  return func().catch((err) => {
    if (retries <= 1) throw err;
    return timeout(interval).then(() => {
      return retry(func, { ...opts, retries: retries - 1, interval: interval * 1.5 });
    });
  });
};

// IKeyValueStorage adapter bridging to window.selector.storage (postMessage to main page localStorage)
const bridgedStorage = {
  async getKeys() {
    return window.selector.storage.keys();
  },
  async getEntries<T = any>(): Promise<[string, T][]> {
    const keys = await this.getKeys();
    return Promise.all(
      keys.map(async (k: string) => {
        const v = await window.selector.storage.get(k);
        return [k, v ? JSON.parse(v) : undefined] as [string, T];
      })
    );
  },
  async getItem<T = any>(key: string): Promise<T | undefined> {
    const v = await window.selector.storage.get(key);
    return v ? JSON.parse(v) : undefined;
  },
  async setItem<T = any>(key: string, value: T): Promise<void> {
    await window.selector.storage.set(key, JSON.stringify(value));
  },
  async removeItem(key: string): Promise<void> {
    await window.selector.storage.remove(key);
  },
};

// Inline WC modal — replaces @walletconnect/modal (126 KB of LitElement UI)
const wcModal = (() => {
  let container: HTMLDivElement | null = null;
  let onClose: (() => void) | null = null;

  const STYLES = `
    .wc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    .wc-card{background:#1d1f20;border-radius:16px;padding:24px;max-width:340px;width:100%;display:flex;flex-direction:column;align-items:center;gap:16px;position:relative}
    .wc-title{color:#e0e0e0;font-size:16px;font-weight:600;margin:0}
    .wc-qr{border-radius:12px;overflow:hidden}
    .wc-copy{background:#2a2d2e;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 20px;font-size:14px;font-weight:500;cursor:pointer;width:100%}
    .wc-copy:hover{background:#353839}
    .wc-close{position:absolute;top:12px;right:12px;background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1}
    .wc-close:hover{color:#fff}
    .wc-spinner{display:flex;align-items:center;justify-content:center;min-height:200px}
  `;

  return {
    openModal({ uri }: { uri: string }) {
      if (container) container.remove();
      container = document.createElement("div");
      container.innerHTML = `<style>${STYLES}</style>
        <div class="wc-overlay">
          <div class="wc-card">
            <button class="wc-close" aria-label="Close">&times;</button>
            <p class="wc-title">Scan with your wallet</p>
            <div class="wc-qr"></div>
            <button class="wc-copy">Copy to clipboard</button>
          </div>
        </div>`;
      document.body.appendChild(container);

      const qrEl = container.querySelector(".wc-qr")!;
      qrEl.appendChild(createQRSvg(uri, 260));

      container.querySelector(".wc-copy")!.addEventListener("click", () => {
        navigator.clipboard.writeText(uri).then(() => {
          const btn = container!.querySelector(".wc-copy")!;
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy to clipboard"), 2000);
        });
      });

      container.querySelector(".wc-close")!.addEventListener("click", () => {
        wcModal.closeModal();
      });

      container.querySelector(".wc-overlay")!.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) wcModal.closeModal();
      });
    },

    subscribeModal(callback: (state: { open: boolean }) => void) {
      onClose = () => callback({ open: false });
    },

    closeModal() {
      if (container) {
        container.remove();
        container = null;
      }
      if (onClose) {
        onClose();
        onClose = null;
      }
    },
  };
})();

let client: InstanceType<typeof SignClient> | null = null;

const getClient = async (): Promise<InstanceType<typeof SignClient>> => {
  if (client) return client;
  const config = await window.selector.walletConnect.getConfig();
  client = await SignClient.init({
    projectId: config.projectId,
    metadata: {
      name: config.metadata?.name ?? "NEAR dApp",
      description: config.metadata?.description ?? "",
      url: config.metadata?.url ?? window.selector.location,
      icons: config.metadata?.icons ?? [],
    },
    storage: bridgedStorage as any,
  });
  return client;
};

const getSession = () => {
  if (!client) return null;
  const keys = client.session.keys;
  if (!keys.length) return null;
  const key = keys[keys.length - 1];
  return key ? client.session.get(key) : null;
};

const connect = async (network: string) => {
  window.selector.ui.showIframe();

  // Show spinner while connecting
  const spinner = document.createElement("div");
  spinner.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)";
  spinner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="80" height="80" style="shape-rendering:auto;display:block;background:transparent"><circle stroke-dasharray="75.4 27.1" r="16" stroke-width="4" stroke="#fff" fill="none" cy="50" cx="50"><animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="1.4s" repeatCount="indefinite" type="rotate" attributeName="transform"/></circle></svg>`;
  document.body.appendChild(spinner);

  const sc = await getClient();
  const result = await sc.connect({
    requiredNamespaces: {
      near: {
        chains: [`near:${network}`],
        methods: WC_METHODS,
        events: WC_EVENTS,
      },
    },
  });

  result.approval();

  await new Promise((resolve) => setTimeout(resolve, 100));
  spinner.remove();
  wcModal.openModal({ uri: result.uri! });

  return new Promise(async (resolve, reject) => {
    wcModal.subscribeModal(({ open }) => {
      if (!open) reject(new Error("User cancelled pairing"));
    });

    while (true) {
      const session = getSession();
      if (session) {
        wcModal.closeModal();
        resolve(session);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
};

const disconnect = async () => {
  const session = getSession();
  if (!session) return;
  const sc = await getClient();
  await sc.disconnect({
    topic: session.topic,
    reason: { code: 5900, message: "User disconnected" },
  });
};

const getSignatureData = (result: any): Uint8Array => {
  if (result instanceof Uint8Array) return result;
  if (Array.isArray(result)) return new Uint8Array(result);
  if (typeof result === "object" && result !== null) {
    if ("data" in result && Array.isArray(result.data)) {
      return new Uint8Array(result.data);
    }
    if ("0" in result && typeof (result as any)[0] === "number") {
      return new Uint8Array(Object.values(result) as any);
    }
    return new Uint8Array(Object.values(result) as any);
  }

  throw new Error("Unexpected result type from near_signTransaction");
};

const serializeTx = (plainTx: PlainTransaction): Uint8Array => {
  return new Uint8Array(borshSerialize(SCHEMA.Transaction, mapTransaction(plainTx)));
};

const WalletConnect = async () => {
  const getAccounts = async (network: string): Promise<Array<{ accountId: string; publicKey: string }>> => {
    const session = getSession();
    if (!session) return [];
    return session.namespaces["near"].accounts.map((account: string) => ({
      accountId: account.replace(`near:${network}:`, ""),
      publicKey: "",
    }));
  };

  const requestAccounts = async (network: string) => {
    const session = getSession();
    if (!session) throw new Error("No active session");
    const sc = await getClient();
    return sc.request({
      topic: session.topic,
      chainId: `near:${network}`,
      request: {
        method: "near_getAccounts",
        params: {},
      },
    });
  };

  const requestSignMessage = async (
    messageParams: { message: string; nonce: number; recipient: string; callbackUrl?: string; accountId?: string },
    network: string
  ) => {
    const { message, nonce, recipient, callbackUrl, accountId } = messageParams;
    const session = getSession();
    if (!session) throw new Error("No active session");
    const sc = await getClient();
    return sc.request({
      topic: session.topic,
      chainId: `near:${network}`,
      request: {
        method: "near_signMessage",
        params: {
          message,
          nonce,
          recipient,
          ...(callbackUrl && { callbackUrl }),
          ...(accountId && { accountId }),
        },
      },
    });
  };

  const requestSignTransaction = async (transaction: { signerId: string; receiverId: string; actions: any[] }, network: string) => {
    const accounts = await requestAccounts(network);
    const account = accounts.find((x: any) => x.accountId === transaction.signerId);
    if (!account) throw new Error("Invalid signer id");

    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<any>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: account.publicKey,
      }),
    ]);

    const plainTx: PlainTransaction = {
      signerId: transaction.signerId,
      publicKey: account.publicKey,
      receiverId: transaction.receiverId,
      nonce: accessKey.nonce + 1,
      blockHash: block.header.hash,
      actions: transaction.actions,
    };

    const encodedTx = serializeTx(plainTx);
    const txArray = Array.from(encodedTx);

    const session = getSession();
    if (!session) throw new Error("No active session");
    const sc = await getClient();
    const result = await sc.request({
      topic: session.topic,
      chainId: `near:${network}`,
      request: {
        method: "near_signTransaction",
        params: { transaction: txArray },
      },
    });

    const signedBytes = getSignatureData(result);

    // Verify the signed transaction is well-formed
    borshDeserialize(SCHEMA.SignedTransaction, signedBytes);

    return signedBytes;
  };

  const requestSignTransactions = async (transactions: Array<{ signerId: string; receiverId: string; actions: any[] }>, network: string) => {
    if (!transactions.length) return [];
    const [block, accounts] = await Promise.all([provider.block({ finality: "final" }), requestAccounts(network)]);

    const encodedTxs: Array<number[]> = [];
    for (let i = 0; i < transactions.length; i += 1) {
      const transaction = transactions[i];
      const account = accounts.find((x: any) => x.accountId === transaction.signerId);
      if (!account) throw new Error("Invalid signer id");

      const accessKey = await provider.query<any>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: account.publicKey,
      });

      const plainTx: PlainTransaction = {
        signerId: transaction.signerId,
        publicKey: account.publicKey,
        receiverId: transaction.receiverId,
        nonce: accessKey.nonce + i + 1,
        blockHash: block.header.hash,
        actions: transaction.actions,
      };

      encodedTxs.push(Array.from(serializeTx(plainTx)));
    }

    const session = getSession();
    if (!session) throw new Error("No active session");
    const sc = await getClient();
    const results = await sc.request({
      topic: session.topic,
      chainId: `near:${network}`,
      request: {
        method: "near_signTransactions",
        params: { transactions: encodedTxs },
      },
    });

    return results.map((result: any) => getSignatureData(result));
  };

  const requestSignOut = async (network: string) => {
    const accounts = await getAccounts(network);
    const session = getSession();
    if (!session) throw new Error("No active session");
    const sc = await getClient();
    await sc.request({
      topic: session.topic,
      request: { method: "near_signOut", params: { accounts } },
      chainId: `near:${network}`,
    });
  };

  const signOut = async (network: string) => {
    if (getSession()) {
      await requestSignOut(network);
      await disconnect();
    }
  };

  const buildAddKeyAction = (addFunctionCallKey: AddFunctionCallKeyParams): AddKeyAction => {
    const methodNames = addFunctionCallKey.allowMethods.anyMethod === false
      ? addFunctionCallKey.allowMethods.methodNames
      : [];

    let allowance: string | undefined;
    if (addFunctionCallKey.gasAllowance) {
      allowance = addFunctionCallKey.gasAllowance.kind === "limited"
        ? addFunctionCallKey.gasAllowance.amount
        : undefined;
    }

    return {
      type: "AddKey",
      params: {
        publicKey: addFunctionCallKey.publicKey,
        accessKey: {
          permission: {
            receiverId: addFunctionCallKey.contractId,
            methodNames,
            allowance,
          },
        },
      },
    };
  };

  const connectAndAddKey = async (addFunctionCallKey: AddFunctionCallKeyParams | undefined, network: string) => {
    if (getSession()) await disconnect();
    await connect(network);

    const accounts = await getAccounts(network);
    if (!accounts.length) throw new Error("Wallet not signed in");

    if (addFunctionCallKey) {
      const signerId = accounts[0].accountId;
      const addKeyAction = buildAddKeyAction(addFunctionCallKey);
      const resolvedTransaction = {
        signerId,
        receiverId: signerId,
        actions: connectorActionsToFastnearActions([addKeyAction]),
      };
      const signedTxBytes = await requestSignTransaction(resolvedTransaction, network);
      await provider.sendJsonRpc("broadcast_tx_commit", [base64Encode(signedTxBytes)]);
    }

    return accounts;
  };

  return {
    async signIn({ addFunctionCallKey, network }: SignInParams) {
      try {
        const accounts = await connectAndAddKey(addFunctionCallKey, network);
        return accounts;
      } catch (err) {
        console.error(err);
        await signOut(network);
        throw err;
      }
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      const { network, messageParams } = data;
      try {
        const accounts = await connectAndAddKey(data.addFunctionCallKey, network);

        const signedMessage = await requestSignMessage({
          message: messageParams.message,
          nonce: Array.from(messageParams.nonce),
          recipient: messageParams.recipient,
        }, network);

        return [{
          accountId: accounts[0].accountId,
          publicKey: accounts[0].publicKey,
          signedMessage: {
            accountId: signedMessage.accountId ?? accounts[0].accountId,
            publicKey: signedMessage.publicKey ?? "",
            signature: signedMessage.signature ?? "",
          },
        }];
      } catch (err) {
        console.error(err);
        await signOut(network);
        throw err;
      }
    },

    async signOut({ network }: { network: string }) {
      await signOut(network);
    },

    async getAccounts({ network }: { network: string }) {
      return getAccounts(network);
    },

    async verifyOwner({ message }: any) {
      throw new Error("Method not supported");
    },

    async signMessage({ message, nonce, recipient, callbackUrl, network }: any) {
      try {
        if (!getSession()) await connect(network);
        return await requestSignMessage({ message, nonce, recipient, callbackUrl }, network);
      } catch (err) {
        await disconnect();
        throw err;
      }
    },

    async signAndSendTransaction({ receiverId, actions, network }: { receiverId: string; actions: ConnectorAction[]; network: string }) {
      const accounts = await getAccounts(network).catch(() => []);
      if (!accounts.length) throw new Error("Wallet not signed in");
      const signerId = accounts[0].accountId;

      const resolvedTransaction = { signerId, receiverId, actions: connectorActionsToFastnearActions(actions) };
      const signedTxBytes = await requestSignTransaction(resolvedTransaction, network);

      return provider.sendJsonRpc<any>("broadcast_tx_commit", [base64Encode(signedTxBytes)]);
    },

    async signAndSendTransactions({ transactions, network }: { transactions: Array<any>; network: string }) {
      const accounts = await getAccounts(network).catch(() => []);
      if (!accounts.length) throw new Error("Wallet not signed in");
      const signerId = accounts[0].accountId;

      const resolvedTransactions = transactions.map((x: any) => ({
        signerId: signerId,
        receiverId: x.receiverId,
        actions: connectorActionsToFastnearActions(x.actions),
      }));

      const signedTxs = await requestSignTransactions(resolvedTransactions, network);
      const results: Array<any> = [];
      for (let i = 0; i < signedTxs.length; i += 1) {
        results.push(await provider.sendJsonRpc("send_tx", { signed_tx_base64: base64Encode(signedTxs[i]), wait_until: "EXECUTED_OPTIMISTIC" }));
      }

      return results;
    },

    async createSignedTransaction() {
      throw new Error(`Method not supported`);
    },

    async signTransaction(transaction: any) {
      throw new Error(`Method not supported`);
    },

    async getPublicKey() {
      throw new Error(`Method not supported`);
    },

    async signNep413Message() {
      throw new Error(`Method not supported`);
    },

    async signDelegateAction() {
      throw new Error(`Method not supported`);
    },
  };
};

WalletConnect().then((wallet) => {
  window.selector.ready(wallet);
});
