import { PublicKey } from "@near-js/crypto";
import { baseDecode } from "@near-js/utils";
import {
  AccessKey,
  AccessKeyPermission,
  Action,
  actionCreators,
  FullAccessPermission,
  FunctionCallPermission,
  GlobalContractDeployMode,
  GlobalContractIdentifier,
} from "@near-js/transactions";

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
        new AccessKey({
          nonce: BigInt(action.params.accessKey.nonce ?? 0),
          permission: new AccessKeyPermission(
            action.params.accessKey.permission === "FullAccess"
              ? new FullAccessPermission()
              : new FunctionCallPermission({
                  receiverId: action.params.accessKey.permission.receiverId,
                  allowance: BigInt(action.params.accessKey.permission.allowance ?? 0),
                  methodNames: action.params.accessKey.permission.methodNames ?? [],
                })
          ),
        })
      );
    }

    throw new Error("Invalid action");
  });
};
