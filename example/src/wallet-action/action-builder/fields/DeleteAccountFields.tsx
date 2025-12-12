import type { DeleteAccountForm } from "../types.ts";

export function DeleteAccountFields(props: { value: DeleteAccountForm; onChange: (next: DeleteAccountForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"input-group"}>
      <p className={"input-label"}>BeneficiaryId</p>
      <input className={"input-text"} value={value.beneficiaryId} onChange={(e) => onChange({ ...value, beneficiaryId: e.target.value })} />
    </div>
  );
}
