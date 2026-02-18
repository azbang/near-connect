import { PublicKey } from "@near-js/crypto";
import { baseDecode } from "@near-js/utils";
import {
  Action,
  actionCreators,
  GlobalContractDeployMode,
  GlobalContractIdentifier,
} from "@near-js/transactions";

// Fireblocks/near-api-js compatibility imports
// @ts-ignore - BN.js doesn't have proper ESM types
import BN from "bn.js";
import { transactions as nearApiTransactions, utils as nearApiUtils } from "near-api-js";

export interface CreateAccountAction {
  type: "CreateAccount";
}

export interface DeployContractAction {
  type: "DeployContract";
  params: { code: Uint8Array };
}

export interface FunctionCallAction {
  type: "FunctionCall";
  params: {
    methodName: string;
    args: object;
    gas: string;
    deposit: string;
  };
}

export interface TransferAction {
  type: "Transfer";
  params: { deposit: string };
}

export interface StakeAction {
  type: "Stake";
  params: {
    stake: string;
    publicKey: string;
  };
}

export type AddKeyPermission =
  | "FullAccess"
  | {
      receiverId: string;
      allowance?: string;
      methodNames?: Array<string>;
    };

export interface AddKeyAction {
  type: "AddKey";
  params: {
    publicKey: string;
    accessKey: {
      nonce?: number;
      permission: AddKeyPermission;
    };
  };
}

export interface DeleteKeyAction {
  type: "DeleteKey";
  params: { publicKey: string };
}
export interface DeleteAccountActionParams {
  beneficiaryId: string;
}
export interface DeleteAccountAction {
  type: "DeleteAccount";
  params: DeleteAccountActionParams;
}

export interface UseGlobalContractAction {
  type: "UseGlobalContract";
  params: { contractIdentifier: { accountId: string } | { codeHash: string } };
}

export interface DeployGlobalContractAction {
  type: "DeployGlobalContract";
  params: { code: Uint8Array; deployMode: "CodeHash" | "AccountId" };
}

export type ConnectorAction =
  | CreateAccountAction
  | DeployContractAction
  | FunctionCallAction
  | TransferAction
  | StakeAction
  | AddKeyAction
  | DeleteKeyAction
  | DeleteAccountAction
  | UseGlobalContractAction
  | DeployGlobalContractAction;

export const connectorActionsToNearActions = (actions: ConnectorAction[]): Action[] => {
  return actions.map((action) => {
    if (!("type" in action)) return action as Action;

    if (action.type === "FunctionCall") {
      return actionCreators.functionCall(action.params.methodName, action.params.args as any, BigInt(action.params.gas), BigInt(action.params.deposit));
    }

    if (action.type === "DeployGlobalContract") {
      const deployMode =
        action.params.deployMode === "AccountId" ? new GlobalContractDeployMode({ AccountId: null }) : new GlobalContractDeployMode({ CodeHash: null });
      return actionCreators.deployGlobalContract(action.params.code, deployMode);
    }

    if (action.type === "CreateAccount") {
      return actionCreators.createAccount();
    }

    if (action.type === "UseGlobalContract") {
      const contractIdentifier =
        "accountId" in action.params.contractIdentifier
          ? new GlobalContractIdentifier({ AccountId: action.params.contractIdentifier.accountId })
          : new GlobalContractIdentifier({ CodeHash: baseDecode(action.params.contractIdentifier.codeHash) });
      return actionCreators.useGlobalContract(contractIdentifier);
    }

    if (action.type === "DeployContract") {
      return actionCreators.deployContract(action.params.code);
    }

    if (action.type === "DeleteAccount") {
      return actionCreators.deleteAccount(action.params.beneficiaryId);
    }

    if (action.type === "DeleteKey") {
      return actionCreators.deleteKey(PublicKey.from(action.params.publicKey));
    }

    if (action.type === "Transfer") {
      return actionCreators.transfer(BigInt(action.params.deposit));
    }

    if (action.type === "Stake") {
      return actionCreators.stake(BigInt(action.params.stake), PublicKey.from(action.params.publicKey));
    }

    if (action.type === "AddKey") {
      return actionCreators.addKey(
        PublicKey.from(action.params.publicKey),
        action.params.accessKey.permission === "FullAccess"
          ? actionCreators.fullAccessKey()
          : actionCreators.functionCallAccessKey(
              action.params.accessKey.permission.receiverId,
              action.params.accessKey.permission.methodNames ?? [],
              BigInt(action.params.accessKey.permission.allowance ?? 0),
            )
      );
    }

    throw new Error("Invalid action");
  });
};

/**
 * Creates near-api-js compatible actions for Fireblocks/WalletConnect
 * Uses BN.js for BigInt handling to match near-api-js serialization
 */
const createNearApiJsAction = (action: ConnectorAction): any => {
  switch (action.type) {
    case "CreateAccount":
      return nearApiTransactions.createAccount();
    case "DeployContract": {
      const { code } = action.params;
      return nearApiTransactions.deployContract(code);
    }
    case "FunctionCall": {
      const { methodName, args, gas, deposit } = action.params;
      return nearApiTransactions.functionCall(methodName, args, new BN(gas) as any, new BN(deposit) as any);
    }
    case "Transfer": {
      const { deposit } = action.params;
      return nearApiTransactions.transfer(new BN(deposit) as any);
    }
    case "Stake": {
      const { stake, publicKey } = action.params;
      return nearApiTransactions.stake(new BN(stake) as any, nearApiUtils.PublicKey.from(publicKey));
    }
    case "AddKey": {
      const { publicKey, accessKey } = action.params;
      const getAccessKey = (permission: AddKeyPermission) => {
        if (permission === "FullAccess") {
          return nearApiTransactions.fullAccessKey();
        }
        const { receiverId, methodNames = [] } = permission;
        const allowance = permission.allowance ? (new BN(permission.allowance) as any) : undefined;
        return nearApiTransactions.functionCallAccessKey(receiverId, methodNames, allowance as any);
      };
      return nearApiTransactions.addKey(nearApiUtils.PublicKey.from(publicKey), getAccessKey(accessKey.permission));
    }
    case "DeleteKey": {
      const { publicKey } = action.params;
      return nearApiTransactions.deleteKey(nearApiUtils.PublicKey.from(publicKey));
    }
    case "DeleteAccount": {
      const { beneficiaryId } = action.params;
      return nearApiTransactions.deleteAccount(beneficiaryId);
    }
    default:
      throw new Error("Invalid action type");
  }
};

/**
 * Converts ConnectorActions to near-api-js compatible actions for Fireblocks
 * This ensures proper transaction serialization for Fireblocks signing
 */
export const connectorActionsToNearApiJsActions = (actions: ConnectorAction[]): any[] => {
  return actions.map((action) => createNearApiJsAction(action));
};
