import type { Action } from "@near-js/transactions";
import { ConnectorAction, AddKeyAction } from "./types";
import { encodeBase58 } from "../helpers/base58";

const deserializeArgs = (args: Uint8Array) => {
  try {
    return JSON.parse(new TextDecoder().decode(args));
  } catch {
    return args;
  }
};

// near-api-js `Enum` instances store the chosen variant under `enum` and may
// carry the *inactive* variant key as an own `undefined` property, so `in`
// checks are only safe as a fallback for enum-less, hand-shaped objects
// (e.g. `{ AccountId: null }`). A variant key whose value is `null` — like
// `GlobalContractDeployMode({ AccountId: null })` — must still be detected.
const isFullAccessPermission = (permission: { enum?: string }): boolean =>
  permission.enum != null ? permission.enum === "fullAccess" : "fullAccess" in permission;

const isAccountIdDeployMode = (deployMode: { enum?: string }): boolean =>
  deployMode.enum != null ? deployMode.enum === "AccountId" : "AccountId" in deployMode;

export const nearActionsToConnectorActions = (actions: (Action | ConnectorAction)[]): ConnectorAction[] => {
  return actions.map((action) => {
    if ("type" in action) return action as ConnectorAction;

    if (action.signedDelegate) {
      throw new Error("SignedDelegate actions cannot be sent through the wallet connector; wallets sign delegates via signDelegateActions");
    }

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
          deployMode: isAccountIdDeployMode(action.deployGlobalContract.deployMode) ? "AccountId" : "CodeHash",
        },
      };
    }

    if (action.createAccount) {
      return { type: "CreateAccount" };
    }

    if (action.useGlobalContract) {
      const identifier = action.useGlobalContract.contractIdentifier;
      return {
        type: "UseGlobalContract",
        params: {
          contractIdentifier:
            identifier.AccountId != null
              ? { accountId: identifier.AccountId }
              : { codeHash: encodeBase58(identifier.CodeHash!) },
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
      const { permission } = action.addKey.accessKey;
      let mapped: AddKeyAction["params"]["accessKey"]["permission"];
      if (permission.functionCall) {
        mapped = {
          receiverId: permission.functionCall.receiverId,
          allowance: permission.functionCall.allowance?.toString(),
          methodNames: permission.functionCall.methodNames,
        };
      } else if (isFullAccessPermission(permission)) {
        mapped = "FullAccess";
      } else {
        // Never guess: an unknown permission (a typo, a gas-key permission, ...)
        // must not be escalated to a full-access key.
        throw new Error(
          "Unsupported access-key permission on AddKey: only functionCall and fullAccess can be sent through the wallet connector (pass a ConnectorAction otherwise)",
        );
      }
      return {
        type: "AddKey",
        params: {
          publicKey: action.addKey.publicKey.toString(),
          accessKey: {
            nonce: Number(action.addKey.accessKey.nonce),
            permission: mapped,
          },
        },
      };
    }

    throw new Error("Unsupported action type");
  });
};
