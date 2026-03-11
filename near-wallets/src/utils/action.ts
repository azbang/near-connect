// Inline base64 encoder so action.ts stays free of @fastnear/utils (avoids portal resolution issues for non-mnw executors)
const _bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

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

/**
 * Convert ConnectorAction[] to the flat action format expected by @fastnear/utils mapAction().
 * This has zero @near-js imports — only used by mnw.ts.
 */
export const connectorActionsToFastnearActions = (actions: ConnectorAction[]): any[] => {
  return actions.map((action) => {
    if (!("type" in action)) return action;

    switch (action.type) {
      case "FunctionCall":
        return {
          type: "FunctionCall",
          methodName: action.params.methodName,
          args: action.params.args,
          gas: action.params.gas,
          deposit: action.params.deposit,
        };
      case "Transfer":
        return { type: "Transfer", deposit: action.params.deposit };
      case "AddKey":
        return {
          type: "AddKey",
          publicKey: action.params.publicKey,
          accessKey: {
            nonce: action.params.accessKey.nonce ?? 0,
            permission: action.params.accessKey.permission === "FullAccess"
              ? "FullAccess"
              : {
                  receiverId: action.params.accessKey.permission.receiverId,
                  methodNames: action.params.accessKey.permission.methodNames ?? [],
                  allowance: action.params.accessKey.permission.allowance,
                },
          },
        };
      case "DeleteKey":
        return { type: "DeleteKey", publicKey: action.params.publicKey };
      case "CreateAccount":
        return { type: "CreateAccount" };
      case "DeleteAccount":
        return { type: "DeleteAccount", beneficiaryId: action.params.beneficiaryId };
      case "DeployContract":
        return { type: "DeployContract", codeBase64: _bytesToBase64(action.params.code) };
      case "Stake":
        return { type: "Stake", stake: action.params.stake, publicKey: action.params.publicKey };
      default:
        throw new Error("Unsupported action type");
    }
  });
};
