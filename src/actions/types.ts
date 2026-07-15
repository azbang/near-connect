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

export interface AddKeyAction {
  type: "AddKey";
  params: {
    publicKey: string;
    gasKeyInfo?: {
      balance: string;
      numNonces: number;
    }
    accessKey: {
      nonce?: number;
      permission:
        | "FullAccess"
        | {
            receiverId: string;
            allowance?: string;
            methodNames?: Array<string>;
          };
    };
  };
}

export interface DeleteKeyAction {
  type: "DeleteKey";
  params: { publicKey: string };
}

export interface DeleteAccountAction {
  type: "DeleteAccount";
  params: { beneficiaryId: string };
}

export interface UseGlobalContractAction {
  type: "UseGlobalContract";
  params: {
    contractIdentifier:
      | { accountId: string }
      | {
          /** Base58 encoded code hash */
          codeHash: string;
        };
  };
}

export interface DeployGlobalContractAction {
  type: "DeployGlobalContract";
  params: { code: Uint8Array; deployMode: "CodeHash" | "AccountId" };
}

export interface TransferToGasKeyAction {
  type: "TransferToGasKey",
  params: {
    publicKey: string;
    deposit: string;
  }
}

export interface WithdrawFromGasKeyAction {
  type: "WithdrawFromGasKey",
  params: {
    publicKey: string;
    amount: string;
  }
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
  | DeployGlobalContractAction
  | TransferToGasKeyAction
  | WithdrawFromGasKeyAction;
