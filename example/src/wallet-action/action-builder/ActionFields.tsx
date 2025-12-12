import type { ActionForm } from "./types.ts";
import { AddKeyFields } from "./fields/AddKeyFields.tsx";
import { CreateAccountFields } from "./fields/CreateAccountFields.tsx";
import { DeleteAccountFields } from "./fields/DeleteAccountFields.tsx";
import { DeleteKeyFields } from "./fields/DeleteKeyFields.tsx";
import { DeployContractFields } from "./fields/DeployContractFields.tsx";
import { DeployGlobalContractFields } from "./fields/DeployGlobalContractFields.tsx";
import { FunctionCallFields } from "./fields/FunctionCallFields.tsx";
import { StakeFields } from "./fields/StakeFields.tsx";
import { TransferFields } from "./fields/TransferFields.tsx";
import { UseGlobalContractFields } from "./fields/UseGlobalContractFields.tsx";

export function ActionFields(props: { value: ActionForm; onChange: (next: ActionForm) => void }) {
  const { value, onChange } = props;
  switch (value.type) {
    case "CreateAccount":
      return <CreateAccountFields value={value} onChange={onChange} />;
    case "DeployContract":
      return <DeployContractFields value={value} onChange={onChange} />;
    case "FunctionCall":
      return <FunctionCallFields value={value} onChange={onChange} />;
    case "Transfer":
      return <TransferFields value={value} onChange={onChange} />;
    case "Stake":
      return <StakeFields value={value} onChange={onChange} />;
    case "AddKey":
      return <AddKeyFields value={value} onChange={onChange} />;
    case "DeleteKey":
      return <DeleteKeyFields value={value} onChange={onChange} />;
    case "DeleteAccount":
      return <DeleteAccountFields value={value} onChange={onChange} />;
    case "UseGlobalContract":
      return <UseGlobalContractFields value={value} onChange={onChange} />;
    case "DeployGlobalContract":
      return <DeployGlobalContractFields value={value} onChange={onChange} />;
  }
}
