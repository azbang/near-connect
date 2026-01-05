import type { ConnectorAction } from "@hot-labs/near-connect";

export type Network = "testnet" | "mainnet";
export type ActionType = ConnectorAction["type"];

export type ActionFormBase = { id: string; type: ActionType; collapsed?: boolean };

export type CreateAccountForm = ActionFormBase & { type: "CreateAccount" };
export type DeployContractForm = ActionFormBase & { type: "DeployContract"; codeBase64: string };
export type FunctionCallForm = ActionFormBase & {
  type: "FunctionCall";
  methodName: string;
  argsJson: string;
  gas: string;
  depositNear: string;
  depositYocto: string;
};
export type TransferForm = ActionFormBase & { type: "Transfer"; depositNear: string; depositYocto: string };
export type StakeForm = ActionFormBase & { type: "Stake"; stakeNear: string; stakeYocto: string; publicKey: string };
export type AddKeyForm = ActionFormBase & {
  type: "AddKey";
  publicKey: string;
  nonce: string;
  permissionType: "FullAccess" | "FunctionCall";
  receiverId: string;
  allowanceNear: string;
  allowanceYocto: string;
  methodNamesCsv: string;
};
export type DeleteKeyForm = ActionFormBase & { type: "DeleteKey"; publicKey: string };
export type DeleteAccountForm = ActionFormBase & { type: "DeleteAccount"; beneficiaryId: string };
export type UseGlobalContractForm = ActionFormBase & {
  type: "UseGlobalContract";
  identifierType: "AccountId" | "CodeHash";
  accountId: string;
  codeHash: string;
};
export type DeployGlobalContractForm = ActionFormBase & {
  type: "DeployGlobalContract";
  codeBase64: string;
  deployMode: "AccountId" | "CodeHash";
};

export type ActionForm =
  | CreateAccountForm
  | DeployContractForm
  | FunctionCallForm
  | TransferForm
  | StakeForm
  | AddKeyForm
  | DeleteKeyForm
  | DeleteAccountForm
  | UseGlobalContractForm
  | DeployGlobalContractForm;

export const ACTION_TYPES: ActionType[] = [
  "CreateAccount",
  "DeployContract",
  "FunctionCall",
  "Transfer",
  "Stake",
  "AddKey",
  "DeleteKey",
  "DeleteAccount",
  "UseGlobalContract",
  "DeployGlobalContract",
];
