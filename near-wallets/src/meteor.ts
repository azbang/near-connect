import { createMeteorAdapter, TransportError } from "@fastnear/wallet-adapter";

import type { ConnectorAction } from "./utils/action";
import type { SignInParams, SignInAndSignMessageParams, AccountWithSignedMessage } from "./utils/types";

const defaults = {
  mainnet: "https://relmn.aurora.dev",
  testnet: "https://rpc.testnet.near.org",
} as const;

const meteor = createMeteorAdapter({
  appKeyPrefix: "near_app",
  getLocation: () => window.selector.location,
  getNetworkProviders: (network) => {
    const providers = window.selector?.providers?.[network];
    if (providers && providers.length > 0) return providers;
    return [defaults[network]];
  },
  storage: {
    get: (key) => window.selector.storage.get(key),
    set: (key, value) => window.selector.storage.set(key, value),
    remove: (key) => window.selector.storage.remove(key),
  },
  openWindow: (url, name, features) => window.selector.open(url, name, features),
  getExtensionBridge: () => {
    const globalWindow = window as any;
    return globalWindow.meteorComV2 ?? globalWindow.meteorCom;
  },
});

const shouldPromptPopupApproval = (error: unknown): boolean => {
  if (error instanceof TransportError && error.code === "POPUP_WINDOW_OPEN_FAILED") return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("popup");
};

const tryApprove = async <T>(request: { title: string; button: string; execute: () => Promise<T> }): Promise<T> => {
  const { title, button, execute } = request;
  try {
    return await execute();
  } catch (error) {
    if (!shouldPromptPopupApproval(error)) throw error;
    await window.selector.ui.whenApprove({ title, button });
    return execute();
  }
};

const MeteorWallet = async () => {
  return {
    async signIn({ network, addFunctionCallKey }: SignInParams) {
      const contractId = addFunctionCallKey?.contractId;
      const methodNames = addFunctionCallKey?.allowMethods?.anyMethod === false
        ? addFunctionCallKey.allowMethods.methodNames
        : undefined;
      return tryApprove({
        title: "Sign in",
        button: "Open wallet",
        execute: () =>
          meteor.signIn({
            network,
            contractId,
            methodNames,
          }),
      });
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      const { network, addFunctionCallKey, messageParams } = data;
      const contractId = addFunctionCallKey?.contractId;
      const methodNames = addFunctionCallKey?.allowMethods?.anyMethod === false
        ? addFunctionCallKey.allowMethods.methodNames
        : undefined;

      const accounts = await tryApprove({
        title: "Sign in",
        button: "Open wallet",
        execute: () => meteor.signIn({ network, contractId, methodNames }),
      });

      const accountId = accounts[0]?.accountId;
      const signedMessage = await tryApprove({
        title: "Sign message",
        button: "Open wallet",
        execute: () => meteor.signMessage({
          network,
          message: messageParams.message,
          nonce: messageParams.nonce,
          recipient: messageParams.recipient,
          accountId,
        }),
      });

      return [{
        accountId: accountId || "",
        publicKey: accounts[0]?.publicKey || "",
        signedMessage: {
          accountId: signedMessage.accountId ?? accountId ?? "",
          publicKey: signedMessage.publicKey ?? "",
          signature: signedMessage.signature ?? "",
        },
      }];
    },

    async signOut({ network }: { network: "mainnet" | "testnet" }) {
      await tryApprove({
        title: "Sign out",
        button: "Open wallet",
        execute: () => meteor.signOut({ network }),
      });
    },

    async isSignedIn({ network }: { network: "mainnet" | "testnet" }) {
      const accounts = await meteor.getAccounts({ network });
      return accounts.length > 0;
    },

    async getAccounts({ network }: { network: "mainnet" | "testnet" }) {
      return meteor.getAccounts({ network });
    },

    async verifyOwner({ network, message, accountId }: { network: "mainnet" | "testnet"; message: string; accountId?: string }) {
      return tryApprove({
        title: "Verify owner",
        button: "Open wallet",
        execute: () => meteor.verifyOwner({ network, message, accountId }),
      });
    },

    async signMessage({ network, message, nonce, recipient, callbackUrl, state, accountId }: any) {
      return tryApprove({
        title: "Sign message",
        button: "Open wallet",
        execute: () =>
          meteor.signMessage({
            network,
            message,
            nonce,
            recipient,
            callbackUrl,
            state,
            accountId,
          }),
      });
    },

    async signAndSendTransaction({
      network,
      signerId,
      receiverId,
      actions,
    }: {
      network: "mainnet" | "testnet";
      signerId?: string;
      receiverId: string;
      actions: ConnectorAction[];
    }) {
      return tryApprove({
        title: "Sign transaction",
        button: "Open wallet",
        execute: () =>
          meteor.signAndSendTransaction({
            network,
            signerId,
            receiverId,
            actions,
          }),
      });
    },

    async signAndSendTransactions({
      network,
      signerId,
      transactions,
    }: {
      network: "mainnet" | "testnet";
      signerId?: string;
      transactions: { receiverId: string; actions: ConnectorAction[] }[];
    }) {
      return tryApprove({
        title: "Sign transactions",
        button: "Open wallet",
        execute: () =>
          meteor.signAndSendTransactions({
            network,
            signerId,
            transactions,
          }),
      });
    },
  };
};

MeteorWallet().then((wallet) => {
  window.selector.ready(wallet);
});
