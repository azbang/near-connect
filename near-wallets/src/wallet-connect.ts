import { WalletConnectModal } from "@walletconnect/modal";
import { Action, createTransaction, SignedTransaction, Transaction } from "@near-js/transactions";
import { AccessKeyViewRaw, FinalExecutionOutcome } from "@near-js/types";
import { baseDecode } from "@near-js/utils";
import { PublicKey } from "@near-js/crypto";

import { NearRpc } from "./utils/rpc";
import { ConnectorAction, connectorActionsToNearActions } from "./utils/action";

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

let modal: typeof WalletConnectModal.prototype;
const connect = async (network: string) => {
  window.selector.ui.showIframe();
  const rect = document.createElement("div");
  rect.innerHTML = `<svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid"
      width="80"
      height="80"
      style="shape-rendering: auto; display: block; background: transparent;"
      xmlns:xlink="http://www.w3.org/1999/xlink"
    >
      <circle stroke-dasharray="75.39822368615503 27.132741228718345" r="16" stroke-width="4" stroke="#fff" fill="none" cy="50" cx="50">
        <animateTransform
          keyTimes="0;1"
          values="0 50 50;360 50 50"
          dur="1.408450704225352s"
          repeatCount="indefinite"
          type="rotate"
          attributeName="transform"
        ></animateTransform>
      </circle>
    </svg>`;

  document.body.appendChild(rect);
  rect.style.position = "absolute";
  rect.style.top = "50%";
  rect.style.left = "50%";
  rect.style.transform = "translate(-50%, -50%)";

  if (!modal) {
    modal = new WalletConnectModal({
      chains: [`near:mainnet`, `near:testnet`],
      projectId: await window.selector.walletConnect.getProjectId(),
      explorerExcludedWalletIds: "ALL",
      themeMode: "dark",
    });
  }

  const result = await window.selector.walletConnect.connect({
    requiredNamespaces: {
      near: {
        chains: [`near:${network}`],
        methods: WC_METHODS,
        events: WC_EVENTS,
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
  await modal.openModal({ uri: result.uri, standaloneChains: [`near:${network}`] });

  return new Promise(async (resolve, reject) => {
    modal.subscribeModal(({ open }) => {
      if (!open) reject(new Error("User cancelled pairing"));
    });

    while (true) {
      const session = await window.selector.walletConnect.getSession();
      if (session) resolve(session);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
};

const disconnect = async () => {
  await window.selector.walletConnect.disconnect({
    topic: (await window.selector.walletConnect.getSession()).topic,
    reason: { code: 5900, message: "User disconnected" },
  });
};

const getSignatureData = (result: Uint8Array) => {
  if (result instanceof Uint8Array) {
    return result;
  } else if (Array.isArray(result)) {
    return new Uint8Array(result);
  } else if (typeof result === "object" && result !== null) {
    return new Uint8Array(Object.values(result));
  } else {
    throw new Error("Unexpected result type from near_signTransaction");
  }
};

const WalletConnect = async () => {
  const getAccounts = async (network: string): Promise<Array<{ accountId: string; publicKey: string }>> => {
    const session = await window.selector.walletConnect.getSession();
    if (!session) return [];
    return session.namespaces["near"].accounts.map((account: string) => ({
      accountId: account.replace(`near:${network}:`, ""),
      publicKey: "",
    }));
  };

  const requestAccounts = async (network: string) => {
    return window.selector.walletConnect.request({
      topic: (await window.selector.walletConnect.getSession()).topic,
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
    return window.selector.walletConnect.request({
      topic: (await window.selector.walletConnect.getSession()).topic,
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

  const requestSignTransaction = async (transaction: { signerId: string; receiverId: string; actions: Array<Action> }, network: string) => {
    const accounts = await requestAccounts(network);
    const account = accounts.find((x: any) => x.accountId === transaction.signerId);
    if (!account) throw new Error("Invalid signer id");

    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<AccessKeyViewRaw>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: account.publicKey,
      }),
    ]);

    const tx = createTransaction(
      transaction.signerId,
      PublicKey.from(account.publicKey),
      transaction.receiverId,
      accessKey.nonce + 1,
      transaction.actions,
      baseDecode(block.header.hash)
    );

    const result = await window.selector.walletConnect.request({
      topic: (await window.selector.walletConnect.getSession()).topic,
      chainId: `near:${network}`,
      request: {
        method: "near_signTransaction",
        params: { transaction: tx.encode() },
      },
    });

    const signatureData = getSignatureData(result);
    return SignedTransaction.decode(Buffer.from(signatureData));
  };

  const requestSignTransactions = async (transactions: Array<{ signerId: string; receiverId: string; actions: Array<Action> }>, network: string) => {
    if (!transactions.length) return [];
    const txs: Array<Transaction> = [];
    const [block, accounts] = await Promise.all([provider.block({ finality: "final" }), requestAccounts(network)]);

    for (let i = 0; i < transactions.length; i += 1) {
      const transaction = transactions[i];
      const account = accounts.find((x: any) => x.accountId === transaction.signerId);
      if (!account) throw new Error("Invalid signer id");

      const accessKey = await provider.query<AccessKeyViewRaw>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: account.publicKey,
      });

      txs.push(
        createTransaction(
          transaction.signerId,
          PublicKey.from(account.publicKey),
          transaction.receiverId,
          accessKey.nonce + i + 1,
          transaction.actions,
          baseDecode(block.header.hash)
        )
      );
    }

    const results = await window.selector.walletConnect.request({
      topic: (await window.selector.walletConnect.getSession()).topic,
      chainId: `near:${network}`,
      request: {
        method: "near_signTransactions",
        params: { transactions: txs.map((x) => x.encode()) },
      },
    });

    return results.map((result: any) => {
      const signatureData = getSignatureData(result);
      return SignedTransaction.decode(Buffer.from(signatureData));
    });
  };

  const requestSignOut = async (network: string) => {
    const accounts = await getAccounts(network);
    await window.selector.walletConnect.request({
      topic: (await window.selector.walletConnect.getSession()).topic,
      request: { method: "near_signOut", params: { accounts } },
      chainId: `near:${network}`,
    });
  };

  const signOut = async (network: string) => {
    if (await window.selector.walletConnect.getSession()) {
      await requestSignOut(network);
      await disconnect();
    }
  };

  return {
    async signIn({ network }: any) {
      try {
        if (await window.selector.walletConnect.getSession()) await disconnect();
        await connect(network);
        return await getAccounts(network);
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
        if (!(await window.selector.walletConnect.getSession())) await connect(network);
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

      const resolvedTransaction = { signerId: signerId, receiverId: receiverId, actions: connectorActionsToNearActions(actions) };
      const signedTx = await requestSignTransaction(resolvedTransaction, network);
      return provider.sendTransaction(signedTx);
    },

    async signAndSendTransactions({ transactions, network }: { transactions: Array<Transaction>; network: string }) {
      const accounts = await getAccounts(network).catch(() => []);
      if (!accounts.length) throw new Error("Wallet not signed in");
      const signerId = accounts[0].accountId;

      const resolvedTransactions = transactions.map((x: any) => ({
        signerId: signerId,
        receiverId: x.receiverId,
        actions: x.actions,
      }));

      const signedTxs = await requestSignTransactions(resolvedTransactions, network);
      const results: Array<FinalExecutionOutcome> = [];
      for (let i = 0; i < signedTxs.length; i += 1) {
        results.push(await provider.sendTransaction(signedTxs[i]));
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
