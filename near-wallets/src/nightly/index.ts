import { baseEncode } from "near-api-js";

import type { ConnectorAction, AddKeyAction } from "../utils/action";
import { signAndSendTransactionsHandler } from "./helper";
import type { SignInParams, SignInAndSignMessageParams, AccountWithSignedMessage, AddFunctionCallKeyParams } from "../utils/types";

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
      return [{ accountId, publicKey: `ed25519:${baseEncode(new Uint8Array(publicKey.ed25519Key.data))}` }];
    }

    return [{ accountId, publicKey: `ed25519:${baseEncode(new Uint8Array(publicKey.data))}` }];
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
    await checkExist();
    let accounts = await getAccounts();
    if (!accounts.length) {
      await window.selector.external("nightly.near", "connect");
      accounts = await getAccounts();
    }
    if (!accounts.length) throw new Error("Wallet not signed in");

    if (addFunctionCallKey) {
      const signerId = accounts[0].accountId;
      const publicKey = accounts[0].publicKey;
      const addKeyAction = buildAddKeyAction(addFunctionCallKey);
      await signAndSendTransactionsHandler(
        [{ signerId, receiverId: signerId, actions: [addKeyAction] }],
        publicKey,
        networks[network],
      );
    }

    return accounts;
  };

  return {
    async signIn({ addFunctionCallKey, network }: SignInParams) {
      const accounts = await connectAndAddKey(addFunctionCallKey, network);
      return accounts;
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      const accounts = await connectAndAddKey(data.addFunctionCallKey, data.network);

      const isConnected = await window.selector.external("nightly.near", "isConnected");
      if (!isConnected) await window.selector.external("nightly.near", "connect");

      const { messageParams } = data;
      const signedMessage = await window.selector.external("nightly.near", "signMessage", {
        nonce: Array.from(messageParams.nonce),
        recipient: messageParams.recipient,
        message: messageParams.message,
      });

      return [{
        accountId: accounts[0].accountId,
        publicKey: accounts[0].publicKey,
        signedMessage: {
          accountId: signedMessage.accountId ?? accounts[0].accountId,
          publicKey: signedMessage.publicKey ?? accounts[0].publicKey ?? "",
          signature: signedMessage.signature ?? "",
        },
      }];
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
      const publicKey = accounts[0].publicKey;
      return (await signAndSendTransactionsHandler([{ signerId, receiverId, actions }], publicKey, networks[network]))[0];
    },

    async signAndSendTransactions({ transactions, network }: { transactions: { receiverId: string; actions: ConnectorAction[] }[]; network: string }) {
      await checkExist();
      const accounts = await getAccounts();
      if (!accounts.length) throw new Error("Wallet not signed in");

      const signerId = accounts[0].accountId;
      const publicKey = accounts[0].publicKey;
      const list = transactions.map((t: any) => ({ ...t, signerId }));
      return await signAndSendTransactionsHandler(list, publicKey, networks[network]);
    },

    async getPublicKey() {
      const accounts = await getAccounts();
      const account = accounts[0];
      if (!account) throw new Error("Failed to find public key for account");
      return account.publicKey;
    },

    async signDelegateAction(delegateAction: any) {
      throw new Error(`Method not supported`);
    },
  };
};

Nightly().then((wallet) => {
  window.selector.ready(wallet);
});
