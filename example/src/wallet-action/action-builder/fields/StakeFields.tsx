import type { StakeForm } from "../types.ts";

export function StakeFields(props: { value: StakeForm; onChange: (next: StakeForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
        <div className={"input-group"}>
          <p className={"input-label"}>Stake (NEAR)</p>
          <input className={"input-text"} value={value.stakeNear} onChange={(e) => onChange({ ...value, stakeNear: e.target.value })} />
        </div>
        <div className={"input-group"}>
          <p className={"input-label"}>Stake (yocto, overrides NEAR)</p>
          <input className={"input-text"} value={value.stakeYocto} onChange={(e) => onChange({ ...value, stakeYocto: e.target.value })} />
        </div>
      </div>
      <div className={"input-group"}>
        <p className={"input-label"}>Public key</p>
        <input className={"input-text"} value={value.publicKey} onChange={(e) => onChange({ ...value, publicKey: e.target.value })} />
      </div>
    </div>
  );
}
