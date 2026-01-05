import { PublicKey } from "@near-js/crypto";
import { baseEncode } from "@near-js/utils";
import { Signer } from "@near-js/signers";

import { ConnectorAction } from "../utils/action";
import { signAndSendTransactionsHandler } from "./helper";

const networks: Record<string, any> = {
  mainnet: {
    nodeUrl: "https://relmn.aurora.dev",
    networkId: "mainnet",
    helperUrl: "",
    explorerUrl: "",
    indexerUrl: "",
  },
  testnet: {
    nodeUrl: "https://test.rpc.fastnear.com",
    networkId: "testnet",
    helperUrl: "",
    explorerUrl: "",
    indexerUrl: "",
  },
};

const checkExist = async () => {
  try {
    await window.selector.external("nightly.near", "isConnected");
  } catch {
    await window.selector.ui.whenApprove({ title: "Download Nightly", button: "Download" });
    window.selector.open("https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa");
  }
};

const Nightly = async () => {
  await window.selector.external("nightly.near", "connect").catch(() => {});

  const getAccounts = async (): Promise<Array<{ accountId: string; publicKey: string }>> => {
    const { accountId, publicKey } = await window.selector.external("nightly.near", "account");
    if (!accountId) return [];

    if (publicKey.ed25519Key) {
      return [{ accountId, publicKey: `ed25519:${baseEncode(publicKey.ed25519Key.data)}` }];
    }

    return [{ accountId, publicKey: `ed25519:${baseEncode(publicKey.data)}` }];
  };

  const signer: Signer = {
    createKey: () => {
      throw new Error("Not implemented");
    },

    getPublicKey: async (accountId) => {
      const accounts = await getAccounts();
      const account = accounts.find((a) => a.accountId === accountId);
      if (!account) throw new Error("Failed to find public key for account");
      return PublicKey.from(account.publicKey!);
    },

    signMessage: async (message, accountId) => {
      const accounts = await getAccounts();
      const account = accounts.find((a) => a.accountId === accountId);

      if (!account) {
        throw new Error("Failed to find account for signing");
      }

      const signedTx = await window.selector.external("nightly.near", "signTransaction", message);
      return { signature: signedTx.signature.data, publicKey: signedTx.publicKey };
    },
  };

  return {
    async signIn({ contractId, methodNames }: { contractId?: string; methodNames?: Array<string> }) {
      await checkExist();
      const existingAccounts = await getAccounts();
      if (existingAccounts.length) return existingAccounts;
      await window.selector.external("nightly.near", "connect", { contractId, methodNames });
      return getAccounts();
    },

    async signOut() {
      await checkExist();
      await window.selector.external("nightly.near", "disconnect");
    },

    async getAccounts() {
      return await getAccounts();
    },

    async verifyOwner({ message }: any) {
      throw new Error(`Method not supported`);
    },

    async signMessage({ message, nonce, recipient, state }: any) {
      await checkExist();
      const isConnected = await window.selector.external("nightly.near", "isConnected");
      if (!isConnected) await window.selector.external("nightly.near", "connect");
      return await window.selector.external("nightly.near", "signMessage", {
        nonce: Array.from(nonce),
        recipient,
        message,
        state,
      });
    },

    async signAndSendTransaction({ receiverId, actions, network }: { receiverId: string; actions: ConnectorAction[]; network: string }) {
      await checkExist();
      const accounts = await getAccounts();
      if (!accounts.length) throw new Error("Wallet not signed in");

      const signerId = accounts[0].accountId;
      return (await signAndSendTransactionsHandler([{ signerId, receiverId, actions }], signer, networks[network]))[0];
    },

    async signAndSendTransactions({ transactions, network }: { transactions: { receiverId: string; actions: ConnectorAction[] }[]; network: string }) {
      await checkExist();
      const accounts = await getAccounts();
      if (!accounts.length) throw new Error("Wallet not signed in");

      const signerId = accounts[0].accountId;
      const list = transactions.map((t: any) => ({ ...t, signerId }));
      return await signAndSendTransactionsHandler(list, signer, networks[network]);
    },

    async getPublicKey() {
      const accounts = await getAccounts();
      const account = accounts[0];
      if (!account) throw new Error("Failed to find public key for account");
      return PublicKey.from(account.publicKey!);
    },

    async signDelegateAction(delegateAction: any) {
      throw new Error(`Method not supported`);
    },
  };
};

Nightly().then((wallet) => {
  window.selector.ready(wallet);
});
