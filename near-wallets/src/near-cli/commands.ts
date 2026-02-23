import { ConnectorAction } from "../utils/action";

export type Network = "mainnet" | "testnet";

export function yoctoToNear(yoctoAmount: string): string {
  if (yoctoAmount === "0") return "0";
  const YOCTO_DECIMALS = 24;
  const padded = yoctoAmount.padStart(YOCTO_DECIMALS + 1, "0");
  const intPart = padded.slice(0, -YOCTO_DECIMALS) || "0";
  const fracPart = padded.slice(-YOCTO_DECIMALS).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function gasToTgas(gasAmount: string): string {
  if (gasAmount === "0") return "0";
  const TGAS_DECIMALS = 12;
  const padded = gasAmount.padStart(TGAS_DECIMALS + 1, "0");
  const intPart = padded.slice(0, -TGAS_DECIMALS) || "0";
  const fracPart = padded.slice(-TGAS_DECIMALS).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export function buildAddKeyCommand({
  accountId,
  publicKey,
  contractId,
  methodNames,
  network,
}: {
  accountId: string;
  publicKey: string;
  contractId?: string;
  methodNames?: string[];
  network: Network;
}): string {
  const parts: string[] = ["near account"];
  parts.push(`add-key '${shellEscape(accountId)}'`);

  if (contractId) {
    parts.push("grant-function-call-access");
    parts.push(`--contract-account-id '${shellEscape(contractId)}'`);
    if (methodNames && methodNames.length > 0) {
      parts.push(`--function-names '${shellEscape(methodNames.join(", "))}'`);
    }
  } else {
    parts.push("grant-full-access");
  }

  parts.push(`use-manually-provided-public-key ${publicKey}`);
  parts.push(`network-config ${network}`);
  parts.push("sign-with-keychain");

  return parts.join(" \\\n    ");
}

function buildActionPart(action: ConnectorAction): string {
  switch (action.type) {
    case "CreateAccount":
      return "add-action create-account";

    case "Transfer":
      return `add-action transfer '${yoctoToNear(action.params.deposit)} NEAR'`;

    case "FunctionCall": {
      const args = JSON.stringify(action.params.args);
      return [
        `add-action function-call '${shellEscape(action.params.methodName)}'`,
        `json-args '${shellEscape(args)}'`,
        `prepaid-gas '${gasToTgas(action.params.gas)} Tgas'`,
        `attached-deposit '${yoctoToNear(action.params.deposit)} NEAR'`,
      ].join(" ");
    }

    case "AddKey":
      if (action.params.accessKey.permission === "FullAccess") {
        return `add-action add-key grant-full-access use-manually-provided-public-key ${action.params.publicKey}`;
      } else {
        const perm = action.params.accessKey.permission;
        const addKeyParts = ["add-action add-key grant-function-call-access"];
        if (perm.allowance) addKeyParts.push(`--allowance '${yoctoToNear(perm.allowance)} NEAR'`);
        addKeyParts.push(`--contract-account-id '${shellEscape(perm.receiverId)}'`);
        if (perm.methodNames && perm.methodNames.length > 0) {
          addKeyParts.push(`--function-names '${shellEscape(perm.methodNames.join(", "))}'`);
        }
        addKeyParts.push(`use-manually-provided-public-key ${action.params.publicKey}`);
        return addKeyParts.join(" ");
      }

    case "DeleteKey":
      return `add-action delete-key ${action.params.publicKey}`;

    case "DeleteAccount":
      return `add-action delete-account beneficiary '${shellEscape(action.params.beneficiaryId)}'`;

    case "Stake":
      return `add-action stake '${yoctoToNear(action.params.stake)} NEAR' ${action.params.publicKey}`;

    case "DeployContract":
    case "DeployGlobalContract":
      throw new Error(`${action.type} is not supported by NEAR CLI wallet — binary data cannot be passed via command line`);

    case "UseGlobalContract":
      throw new Error("UseGlobalContract is not supported by NEAR CLI wallet");

    default:
      throw new Error("Unknown action type");
  }
}

export function buildTransactionCommand({
  signerId,
  receiverId,
  actions,
  network,
}: {
  signerId: string;
  receiverId: string;
  actions: ConnectorAction[];
  network: Network;
}): string {
  // Single FunctionCall → specialized command
  if (actions.length === 1 && actions[0].type === "FunctionCall") {
    const fc = actions[0].params;
    const args = JSON.stringify(fc.args);
    return [
      "near contract",
      "call-function",
      `as-transaction '${shellEscape(receiverId)}' '${shellEscape(fc.methodName)}'`,
      `json-args '${shellEscape(args)}'`,
      `prepaid-gas '${gasToTgas(fc.gas)} Tgas'`,
      `attached-deposit '${yoctoToNear(fc.deposit)} NEAR'`,
      `sign-as '${shellEscape(signerId)}'`,
      `network-config ${network}`,
      "sign-with-keychain",
    ].join(" \\\n    ");
  }

  // Single Transfer → specialized command
  if (actions.length === 1 && actions[0].type === "Transfer") {
    return [
      "near tokens",
      `'${shellEscape(signerId)}'`,
      `send-near '${shellEscape(receiverId)}' '${yoctoToNear(actions[0].params.deposit)} NEAR'`,
      `network-config ${network}`,
      "sign-with-keychain",
    ].join(" \\\n    ");
  }

  // Multi-action or other single actions → construct-transaction
  const actionParts = actions.map(buildActionPart);
  return [
    "near transaction",
    `construct-transaction '${shellEscape(signerId)}' '${shellEscape(receiverId)}'`,
    ...actionParts,
    "skip",
    `network-config ${network}`,
    "sign-with-keychain",
  ].join(" \\\n    ");
}

export function buildSignMessageCommand({
  message,
  recipient,
  nonce,
  network,
  signerId,
}: {
  message: string;
  recipient: string;
  nonce: string;
  network: Network;
  signerId: string;
}): string {
  return [
    "near message sign-nep413",
    `utf8 '${shellEscape(message)}'`,
    `nonce '${shellEscape(nonce)}'`,
    `recipient '${shellEscape(recipient)}'`,
    `sign-as '${shellEscape(signerId)}'`,
    "sign-with-keychain",
    `network-config ${network}`,
  ].join(" \\\n    ");
}
