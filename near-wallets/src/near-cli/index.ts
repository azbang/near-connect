import { Account, Connection, InMemorySigner } from "near-api-js";
import { Action } from "@near-js/transactions";
import { FinalExecutionOutcome } from "@near-js/types";
import { KeyPair } from "@near-js/crypto";

import { NearRpc } from "../utils/rpc";
import { connectorActionsToNearActions, ConnectorAction } from "../utils/action";
import { buildAddKeyCommand, buildTransactionCommand, buildSignMessageCommand, Network } from "./commands";
import {
  headHtml,
  accountIdInputHtml,
  addKeyCommandHtml,
  transactionCommandHtml,
  signMessageCommandHtml,
  loadingHtml,
} from "./view";

interface FunctionCallKey {
  privateKey: string;
  contractId: string;
  methods: string[];
}

// --- Storage helpers ---

const storage = () => window.selector.storage;

async function getStoredAccountId(network: string): Promise<string> {
  return (await storage().get(`cli:${network}:accountId`)) || "";
}

async function setStoredAccountId(network: string, accountId: string): Promise<void> {
  await storage().set(`cli:${network}:accountId`, accountId);
}

async function removeStoredAccountId(network: string): Promise<void> {
  await storage().remove(`cli:${network}:accountId`);
}

async function getStoredFunctionCallKey(network: string): Promise<FunctionCallKey | null> {
  const raw = await storage().get(`cli:${network}:functionCallKey`);
  return raw ? JSON.parse(raw) : null;
}

async function setStoredFunctionCallKey(network: string, key: FunctionCallKey): Promise<void> {
  await storage().set(`cli:${network}:functionCallKey`, JSON.stringify(key));
}

async function removeStoredFunctionCallKey(network: string): Promise<void> {
  await storage().remove(`cli:${network}:functionCallKey`);
}

// --- RPC ---

function getRpc(network: string): NearRpc {
  const providers = window.selector?.providers?.[network as "mainnet" | "testnet"];
  const fallback = network === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com";
  return new NearRpc(providers && providers.length > 0 ? providers : [fallback]);
}

// --- UI helpers ---

function renderPage(html: string): HTMLElement {
  document.head.innerHTML = headHtml;
  document.body.innerHTML = "";
  const root = document.createElement("div");
  root.style.height = "100%";
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function setupCopyButtons(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const command = btn.getAttribute("data-command") || "";
      try {
        await navigator.clipboard.writeText(command);
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = orig;
        }, 1500);
      } catch {
        // fallback: select the code block text
        const code = btn.parentElement?.querySelector("code");
        if (code) {
          const range = document.createRange();
          range.selectNodeContents(code);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    });
  });
}

function showError(root: HTMLElement, message: string): void {
  const el = root.querySelector<HTMLElement>("#error");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

// --- Prompt helpers ---

function promptAccountId(opts: {
  title: string;
  subtitle?: string;
  buttonText: string;
  step?: string;
}): Promise<string> {
  return new Promise((resolve) => {
    const root = renderPage(accountIdInputHtml(opts));
    window.selector.ui.showIframe();

    const input = root.querySelector<HTMLInputElement>("#account-id")!;
    const btn = root.querySelector<HTMLButtonElement>("#submit-btn")!;

    const submit = () => {
      const accountId = input.value.trim();
      if (!accountId) {
        showError(root, "Please enter an account ID");
        return;
      }
      resolve(accountId);
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

function promptAddKeyCommand(command: string, step?: string): Promise<void> {
  return new Promise((resolve) => {
    const root = renderPage(addKeyCommandHtml(command, step));
    setupCopyButtons(root);
    window.selector.ui.showIframe();

    root.querySelector<HTMLButtonElement>("#done-btn")!.addEventListener("click", () => {
      resolve();
    });
  });
}

function promptTransactionHash(command: string): Promise<string> {
  return new Promise((resolve) => {
    const root = renderPage(transactionCommandHtml(command));
    setupCopyButtons(root);
    window.selector.ui.showIframe();

    const input = root.querySelector<HTMLInputElement>("#tx-hash")!;
    const btn = root.querySelector<HTMLButtonElement>("#verify-btn")!;

    const submit = () => {
      const raw = input.value.trim();
      if (!raw) {
        showError(root, "Please paste the transaction hash or explorer URL");
        return;
      }
      // Extract hash from: explorer URL, "Transaction ID: HASH", or plain HASH
      const urlMatch = raw.match(/(?:txns?|transactions)\/([A-Za-z0-9]{43,44})/);
      if (urlMatch) {
        resolve(urlMatch[1]);
        return;
      }
      const match = raw.match(/(?:Transaction ID:\s*)?([A-Za-z0-9]{43,44})/);
      const hash = match ? match[1] : raw;
      resolve(hash);
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

interface SignMessageOutput {
  accountId: string;
  publicKey: string;
  signature: string;
}

function promptSignMessageOutput(command: string, step?: string): Promise<SignMessageOutput> {
  return new Promise((resolve) => {
    const root = renderPage(signMessageCommandHtml(command, step));
    setupCopyButtons(root);
    window.selector.ui.showIframe();

    const textarea = root.querySelector<HTMLTextAreaElement>("#sign-output")!;
    const btn = root.querySelector<HTMLButtonElement>("#submit-sign-btn")!;

    btn.addEventListener("click", () => {
      const raw = textarea.value.trim();
      if (!raw) {
        showError(root, "Please paste the command output");
        return;
      }

      try {
        // Try to extract JSON from the pasted text
        const jsonMatch = raw.match(/\{[\s\S]*"signature"[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No valid JSON found");

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.signature || !parsed.publicKey) {
          throw new Error("Missing signature or publicKey in output");
        }

        resolve({
          accountId: parsed.accountId || "",
          publicKey: parsed.publicKey,
          signature: parsed.signature,
        });
      } catch (err: any) {
        showError(root, `Could not parse output: ${err.message}`);
      }
    });
  });
}

function showLoading(message: string): void {
  renderPage(loadingHtml(message));
  window.selector.ui.showIframe();
}

// --- Signing helpers ---

function storedKeyCanSign(receiverId: string, actions: Action[], fck: FunctionCallKey | null): boolean {
  if (!fck || fck.contractId !== receiverId) return false;
  if (actions.length !== 1) return false;
  const action = actions[0];
  return !!(
    action.functionCall &&
    action.functionCall.deposit.toString() === "0" &&
    (fck.methods.length === 0 || fck.methods.includes(action.functionCall.methodName))
  );
}

async function signUsingKeyPair(
  network: string,
  accountId: string,
  fck: FunctionCallKey,
  receiverId: string,
  actions: Action[],
): Promise<FinalExecutionOutcome> {
  const keyPair = KeyPair.fromString(fck.privateKey as any);
  const rpc = getRpc(network);
  const signer = await InMemorySigner.fromKeyPair(network, accountId, keyPair);
  const connection = new Connection(network, rpc, signer, "");
  const account = new Account(connection, accountId);
  return account.signAndSendTransaction({ receiverId, actions });
}

async function verifyTransaction(
  rpc: NearRpc,
  txHash: string,
  signerId: string,
  retries = 5,
): Promise<FinalExecutionOutcome> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await rpc.txStatus(txHash, signerId, "NONE");
    } catch (err) {
      lastError = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError ?? new Error(`Transaction ${txHash} not found after ${retries} attempts`);
}

// --- Main wallet class ---

class NearCliWallet {
  signIn = async ({ contractId, methodNames, network }: any) => {
    const existingAccountId = await getStoredAccountId(network);
    if (existingAccountId) {
      const fck = await getStoredFunctionCallKey(network);
      const publicKey = fck ? KeyPair.fromString(fck.privateKey as any).getPublicKey().toString() : "";
      return [{ accountId: existingAccountId, publicKey }];
    }

    if (contractId) {
      // Step 1: Ask for account ID
      const accountId = await promptAccountId({
        title: "Connect with NEAR CLI",
        subtitle: "Enter your NEAR account ID",
        buttonText: "Next",
        step: "Step 1 of 2",
      });

      // Step 2: Generate keypair and show add-key command
      const keyPair = KeyPair.fromRandom("ed25519");
      const publicKey = keyPair.getPublicKey().toString();

      const command = buildAddKeyCommand({
        accountId,
        publicKey,
        contractId,
        methodNames,
        network,
      });

      await promptAddKeyCommand(command, "Step 2 of 2");

      // Store credentials
      const fck: FunctionCallKey = {
        privateKey: keyPair.toString(),
        contractId,
        methods: methodNames || [],
      };
      await setStoredAccountId(network, accountId);
      await setStoredFunctionCallKey(network, fck);

      return [{ accountId, publicKey }];
    } else {
      // Sign-in without add-key: just ask for account ID
      const accountId = await promptAccountId({
        title: "Connect with NEAR CLI",
        subtitle: "Enter your NEAR account ID",
        buttonText: "Connect",
      });

      await setStoredAccountId(network, accountId);

      return [{ accountId, publicKey: "" }];
    }
  };

  signInAndSignMessage = async ({ contractId, methodNames, network, messageParams }: any) => {
    const { message, recipient, nonce } = messageParams;
    const totalSteps = contractId ? 3 : 2;

    // Step 1: Ask for account ID
    const accountId = await promptAccountId({
      title: "Connect with NEAR CLI",
      subtitle: "Enter your NEAR account ID to sign in and sign a message",
      buttonText: "Next",
      step: `Step 1 of ${totalSteps}`,
    });

    // Step 2: Show sign-message command
    const nonceBase64 = Buffer.from(nonce).toString("base64");
    const command = buildSignMessageCommand({
      message,
      recipient,
      nonce: nonceBase64,
      network,
      signerId: accountId,
    });

    const output = await promptSignMessageOutput(command, `Step 2 of ${totalSteps}`);

    // If contractId provided, also generate keypair and show add-key
    let publicKey = output.publicKey;
    if (contractId) {
      const keyPair = KeyPair.fromRandom("ed25519");
      publicKey = keyPair.getPublicKey().toString();

      const addKeyCmd = buildAddKeyCommand({
        accountId,
        publicKey,
        contractId,
        methodNames,
        network,
      });

      await promptAddKeyCommand(addKeyCmd, `Step 3 of ${totalSteps}`);

      const fck: FunctionCallKey = {
        privateKey: keyPair.toString(),
        contractId,
        methods: methodNames || [],
      };
      await setStoredFunctionCallKey(network, fck);
    }

    await setStoredAccountId(network, accountId);

    return [
      {
        accountId,
        publicKey,
        signedMessage: {
          accountId: output.accountId || accountId,
          publicKey: output.publicKey,
          signature: output.signature,
        },
      },
    ];
  };

  signOut = async ({ network }: { network: string }) => {
    await removeStoredAccountId(network);
    await removeStoredFunctionCallKey(network);
  };

  getAccounts = async ({ network }: { network: string }) => {
    const accountId = await getStoredAccountId(network);
    if (!accountId) return [];
    const fck = await getStoredFunctionCallKey(network);
    const publicKey = fck ? KeyPair.fromString(fck.privateKey as any).getPublicKey().toString() : "";
    return [{ accountId, publicKey }];
  };

  signAndSendTransaction = async ({
    receiverId,
    actions: connectorActions,
    network,
  }: {
    receiverId: string;
    actions: ConnectorAction[];
    network: string;
  }): Promise<FinalExecutionOutcome> => {
    const accountId = await getStoredAccountId(network);
    if (!accountId) throw new Error("Wallet not signed in");

    const actions = connectorActionsToNearActions(connectorActions);
    const fck = await getStoredFunctionCallKey(network);

    // Try local signing first
    if (storedKeyCanSign(receiverId, actions, fck)) {
      try {
        return await signUsingKeyPair(network, accountId, fck!, receiverId, actions);
      } catch (error) {
        console.warn("Failed to sign using stored key, falling back to CLI", error);
      }
    }

    // Show CLI command
    const command = buildTransactionCommand({
      signerId: accountId,
      receiverId,
      actions: connectorActions,
      network: network as Network,
    });

    try {
      const txHash = await promptTransactionHash(command);
      showLoading("Verifying transaction...");
      const rpc = getRpc(network);
      return await verifyTransaction(rpc, txHash, accountId);
    } finally {
      window.selector.ui.hideIframe();
    }
  };

  signAndSendTransactions = async ({
    transactions,
    network,
  }: {
    transactions: { receiverId: string; actions: ConnectorAction[] }[];
    network: string;
  }): Promise<FinalExecutionOutcome[]> => {
    const accountId = await getStoredAccountId(network);
    if (!accountId) throw new Error("Wallet not signed in");

    const fck = await getStoredFunctionCallKey(network);
    const rpc = getRpc(network);
    const results: FinalExecutionOutcome[] = [];

    try {
      for (const tx of transactions) {
        const actions = connectorActionsToNearActions(tx.actions);

        // Try local signing first
        if (storedKeyCanSign(tx.receiverId, actions, fck)) {
          try {
            results.push(await signUsingKeyPair(network, accountId, fck!, tx.receiverId, actions));
            continue;
          } catch (error) {
            console.warn("Failed to sign using stored key, falling back to CLI", error);
          }
        }

        // Show CLI command for this transaction
        const command = buildTransactionCommand({
          signerId: accountId,
          receiverId: tx.receiverId,
          actions: tx.actions,
          network: network as Network,
        });

        const txHash = await promptTransactionHash(command);
        showLoading("Verifying transaction...");
        const result = await verifyTransaction(rpc, txHash, accountId);
        results.push(result);
      }

      return results;
    } finally {
      window.selector.ui.hideIframe();
    }
  };

  signMessage = async ({ message, nonce, recipient, network }: any) => {
    const accountId = await getStoredAccountId(network);
    if (!accountId) throw new Error("Wallet not signed in");

    const nonceBase64 = Buffer.from(nonce).toString("base64");
    const command = buildSignMessageCommand({
      message,
      recipient,
      nonce: nonceBase64,
      network,
      signerId: accountId,
    });

    try {
      const output = await promptSignMessageOutput(command);
      return {
        accountId: output.accountId || accountId,
        publicKey: output.publicKey,
        signature: output.signature,
      };
    } finally {
      window.selector.ui.hideIframe();
    }
  };

  signDelegateActions = async () => {
    throw new Error("signDelegateActions is not supported by NEAR CLI wallet");
  };
}

window.selector.ready(new NearCliWallet());
