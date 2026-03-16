import { isCurrentBrowserSupported } from "./utils/detectBrowser";
import { NearRpc } from "./utils/rpc";
import type { ConnectorAction, FunctionCallAction } from "./utils/action";
import type { SignInParams, SignInAndSignMessageParams, AccountWithSignedMessage } from "./utils/types";

const checkExist = async () => {
  try {
    await window.selector.external("okxwallet.near", "isSignedIn");
  } catch {
    let downloadUrl = "https://chromewebstore.google.com/detail/%E6%AC%A7%E6%98%93-web3-%E9%92%B1%E5%8C%85/mcohilncbfahbmgdjkbpemcciiolgcge";
    if (isCurrentBrowserSupported(["safari"])) downloadUrl = "https://apps.apple.com/us/app/okx-wallet/id6463797825";
    if (isCurrentBrowserSupported(["edge-chromium"]))
      downloadUrl = "https://microsoftedge.microsoft.com/addons/detail/%E6%AC%A7%E6%98%93-web3-%E9%92%B1%E5%8C%85/pbpjkcldjiffchgbbndmhojiacbgflha";

    await window.selector.ui.whenApprove({ title: "Download OKX Wallet", button: "Download" });
    window.selector.open(downloadUrl);
  }
};

const provider = new NearRpc(window.selector?.providers?.mainnet);

const okx = async (method: string, ...params: any[]): Promise<any> => {
  return await window.selector.external("okxwallet.near", method, ...params);
};

const OKXWallet = async () => {
  const signOut = async () => {
    if (!(await okx("isSignedIn"))) return;
    await okx("signOut");
  };

  const getAccounts = async () => {
    const accountId = await okx("getAccountId");
    if (!accountId) return [];
    return [{ accountId }];
  };

  return {
    async signIn({ addFunctionCallKey }: SignInParams) {
      try {
        await checkExist();
        const contractId = addFunctionCallKey?.contractId ?? "";
        const methodNames = addFunctionCallKey?.allowMethods?.anyMethod === false
          ? addFunctionCallKey.allowMethods.methodNames
          : undefined;
        const { accessKey, accountId } = await okx("requestSignIn", { contractId, methodNames });
        const respPublicKey = accessKey?.publicKey;
        return [{ accountId, publicKey: respPublicKey ? respPublicKey.toString() : undefined }];
      } catch (_) {
        await signOut();
        throw new Error("Failed to sign in");
      }
    },

    async signInAndSignMessage(data: SignInAndSignMessageParams): Promise<AccountWithSignedMessage[]> {
      try {
        await checkExist();
        const contractId = data.addFunctionCallKey?.contractId ?? "";
        const methodNames = data.addFunctionCallKey?.allowMethods?.anyMethod === false
          ? data.addFunctionCallKey.allowMethods.methodNames
          : undefined;
        const { accessKey, accountId } = await okx("requestSignIn", { contractId, methodNames });
        const respPublicKey = accessKey?.publicKey;

        const { messageParams } = data;
        const signedMessage = await okx("signMessage", {
          message: messageParams.message,
          recipient: messageParams.recipient,
          nonce: Array.from(messageParams.nonce),
        });

        return [{
          accountId,
          publicKey: respPublicKey ? respPublicKey.toString() : undefined,
          signedMessage: {
            accountId: signedMessage.accountId ?? accountId,
            publicKey: signedMessage.publicKey ?? "",
            signature: signedMessage.signature ?? "",
          },
        }];
      } catch (_) {
        await signOut();
        throw new Error("Failed to sign in");
      }
    },

    signOut,
    getAccounts,

    async verifyOwner() {
      throw new Error(`Method not supported by OKX Wallet`);
    },

    async signMessage(message: any) {
      try {
        await checkExist();
        const signedMessage = await okx("signMessage", message);
        return signedMessage;
      } catch (error) {
        throw new Error("sign Error");
      }
    },

    async signAndSendTransaction({ receiverId, actions }: { receiverId: string; actions: Array<ConnectorAction> }) {
      await checkExist();
      if (!(await okx("isSignedIn"))) throw new Error("Wallet not signed in");
      if (!receiverId) throw new Error("Receiver ID is required");

      try {
        const signedTx = await okx("signTransaction", {
          receiverId: receiverId,
          actions: actions
            .filter((a): a is FunctionCallAction => a.type === "FunctionCall")
            .map((a) => a.params),
        });

        return provider.sendJsonRpc("send_tx", {
          signed_tx_base64: signedTx,
          wait_until: "EXECUTED_OPTIMISTIC",
        });
      } catch (error) {
        console.error("signAndSendTransaction", error);
        throw new Error("sign Error");
      }
    },

    async signAndSendTransactions({ transactions }: { transactions: Array<{ receiverId: string; actions: ConnectorAction[] }> }) {
      await checkExist();
      if (!(await okx("isSignedIn"))) throw new Error("Wallet not signed in");

      if (transactions.some((transaction) => transaction.actions.some((action) => action.type !== "FunctionCall"))) {
        throw new Error("Only FunctionCall actions are supported by OKX Wallet");
      }

      try {
        const resp = await okx("requestSignTransactions", {
          transactions: transactions.map((transaction) => ({
            actions: transaction.actions.map((action) => (action as FunctionCallAction).params),
            receiverId: transaction.receiverId,
          })),
        });

        const { txs } = resp;
        const results = [];

        for (let i = 0; i < txs.length; i++) {
          results.push(await provider.sendJsonRpc("send_tx", {
            signed_tx_base64: txs[i].signedTx,
            wait_until: "EXECUTED_OPTIMISTIC",
          }));
        }

        return results;
      } catch (error) {
        console.error("signAndSendTransactions", error);
        throw new Error("sign Error");
      }
    },

    async createSignedTransaction(receiverId: string, actions: Array<ConnectorAction>) {
      await checkExist();
      if (!(await okx("isSignedIn"))) throw new Error("Wallet not signed in");
      if (!receiverId) throw new Error("Receiver ID is required");

      if (actions.some((action) => action.type !== "FunctionCall")) {
        throw new Error("Only FunctionCall actions are supported by OKX Wallet");
      }

      try {
        const signedTx = await okx("signTransaction", {
          actions: actions.map((action) => (action as FunctionCallAction).params),
          receiverId: receiverId,
        });

        return signedTx;
      } catch (error) {
        throw new Error("Failed to create signed transaction");
      }
    },
  };
};

OKXWallet().then((wallet) => {
  window.selector.ready(wallet);
});
