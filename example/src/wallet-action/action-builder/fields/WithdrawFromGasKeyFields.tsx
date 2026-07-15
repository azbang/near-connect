import type { WithdrawFromGasKeyForm } from "../types.ts";

export function WithdrawFromGasKeyFields(props: { value: WithdrawFromGasKeyForm; onChange: (next: WithdrawFromGasKeyForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
      <div className={"input-group md:col-span-2"}>
        <p className={"input-label"}>Public key</p>
        <input className={"input-text"} value={value.publicKey} onChange={(e) => onChange({ ...value, publicKey: e.target.value })} />
      </div>
      <div className={"input-group"}>
        <p className={"input-label"}>Amount (NEAR)</p>
        <input className={"input-text"} value={value.amountNear} onChange={(e) => onChange({ ...value, amountNear: e.target.value })} />
      </div>
      <div className={"input-group"}>
        <p className={"input-label"}>Amount (yocto, overrides NEAR)</p>
        <input className={"input-text"} value={value.amountYocto} onChange={(e) => onChange({ ...value, amountYocto: e.target.value })} />
      </div>
    </div>
  );
}
