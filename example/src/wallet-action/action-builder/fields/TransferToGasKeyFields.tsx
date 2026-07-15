import type { TransferToGasKeyForm } from "../types.ts";

export function TransferToGasKeyFields(props: { value: TransferToGasKeyForm; onChange: (next: TransferToGasKeyForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
      <div className={"input-group md:col-span-2"}>
        <p className={"input-label"}>Public key</p>
        <input className={"input-text"} value={value.publicKey} onChange={(e) => onChange({ ...value, publicKey: e.target.value })} />
      </div>
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
