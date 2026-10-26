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

/**
 * Gas keys (protocol 85+): an access key with its own prepaid balance that
 * pays the gas of whatever it signs, over `numNonces` independent nonce lanes.
 * An `AddKey` creates one when `params.gasKeyInfo` is present: a "FullAccess"
 * permission becomes GasKeyFullAccess, a function-call permission becomes
 * GasKeyFunctionCall (which cannot carry an allowance — the balance is the
 * allowance). Field names follow Meteor's executor format.
 */
export interface GasKeyInfo {
  /** yoctoNEAR as a decimal string. Must be "0" on AddKey; fund it afterwards with TransferToGasKey. */
  balance: string;
  /** Independent nonce lanes, 1..1024. The AddKey fee grows with it. */
  numNonces: number;
}

export interface AddKeyAction {
  type: "AddKey";
  params: {
    publicKey: string;
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
    /** Present ⇒ this AddKey creates a gas key (see GasKeyInfo). */
    gasKeyInfo?: GasKeyInfo;
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

/** Fund a gas key's balance. Any account may send it; `deposit` leaves the sender. */
export interface TransferToGasKeyAction {
  type: "TransferToGasKey";
  params: { publicKey: string; deposit: string };
}

/** Move `amount` from a gas key back to its account. Only the owning account may sign it; not allowed inside a delegate. */
export interface WithdrawFromGasKeyAction {
  type: "WithdrawFromGasKey";
  params: { publicKey: string; amount: string };
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
