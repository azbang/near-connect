import type { Action } from "@near-js/transactions";
import { ConnectorAction } from "./types";
import { encodeBase58 } from "../helpers/base58";

const deserializeArgs = (args: Uint8Array) => {
  try {
    return JSON.parse(new TextDecoder().decode(args));
  } catch {
    return args;
  }
};

export const nearActionsToConnectorActions = (actions: (Action | ConnectorAction)[]): ConnectorAction[] => {
  return actions.map((action) => {
    if ("type" in action) return action as ConnectorAction;

    if (action.functionCall) {
      return {
        type: "FunctionCall",
        params: {
          methodName: action.functionCall.methodName,
          args: deserializeArgs(action.functionCall.args),
          gas: action.functionCall.gas.toString(),
          deposit: action.functionCall.deposit.toString(),
        },
      };
    }

    if (action.deployGlobalContract) {
      return {
        type: "DeployGlobalContract",
        params: {
          code: action.deployGlobalContract.code,
          deployMode: action.deployGlobalContract.deployMode.AccountId ? "AccountId" : "CodeHash",
        },
      };
    }

    if (action.createAccount) {
      return { type: "CreateAccount" };
    }

    if (action.useGlobalContract) {
      return {
        type: "UseGlobalContract",
        params: {
          contractIdentifier: action.useGlobalContract.contractIdentifier.AccountId
            ? { accountId: action.useGlobalContract.contractIdentifier.AccountId }
            : { codeHash: encodeBase58(action.useGlobalContract.contractIdentifier.CodeHash!) },
        },
      };
    }

    if (action.deployContract) {
      return {
        type: "DeployContract",
        params: { code: action.deployContract.code },
      };
    }

    if (action.deleteAccount) {
      return {
        type: "DeleteAccount",
        params: { beneficiaryId: action.deleteAccount.beneficiaryId },
      };
    }

    if (action.deleteKey) {
      return {
        type: "DeleteKey",
        params: { publicKey: action.deleteKey.publicKey.toString() },
      };
    }

    if (action.transfer) {
      return {
        type: "Transfer",
        params: { deposit: action.transfer.deposit.toString() },
      };
    }

    if (action.stake) {
      return {
        type: "Stake",
        params: {
          stake: action.stake.stake.toString(),
          publicKey: action.stake.publicKey.toString(),
        },
      };
    }

    if (action.addKey) {
      return {
        type: "AddKey",
        params: {
          publicKey: action.addKey.publicKey.toString(),
          accessKey: {
            nonce: Number(action.addKey.accessKey.nonce),
            permission: action.addKey.accessKey.permission.functionCall
              ? {
                  receiverId: action.addKey.accessKey.permission.functionCall.receiverId,
                  allowance: action.addKey.accessKey.permission.functionCall.allowance?.toString(),
                  methodNames: action.addKey.accessKey.permission.functionCall.methodNames,
                }
              : "FullAccess",
          },
        },
      };
    }

    throw new Error("Unsupported action type");
  });
};
