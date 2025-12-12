import type { TransferForm } from "../types.ts";

export function TransferFields(props: { value: TransferForm; onChange: (next: TransferForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
      <div className={"input-group"}>
        <p className={"input-label"}>Deposit (NEAR)</p>
        <input className={"input-text"} value={value.depositNear} onChange={(e) => onChange({ ...value, depositNear: e.target.value })} />
      </div>
      <div className={"input-group"}>
        <p className={"input-label"}>Deposit (yocto, overrides NEAR)</p>
        <input className={"input-text"} value={value.depositYocto} onChange={(e) => onChange({ ...value, depositYocto: e.target.value })} />
      </div>
    </div>
  );
}
