import type { FunctionCallForm } from "../types.ts";

export function FunctionCallFields(props: { value: FunctionCallForm; onChange: (next: FunctionCallForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
        <div className={"input-group"}>
          <p className={"input-label"}>Method</p>
          <input className={"input-text"} value={value.methodName} onChange={(e) => onChange({ ...value, methodName: e.target.value })} />
        </div>
        <div className={"input-group"}>
          <p className={"input-label"}>Gas</p>
          <input className={"input-text"} value={value.gas} onChange={(e) => onChange({ ...value, gas: e.target.value })} />
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
      <div className={"input-group"}>
        <p className={"input-label"}>Args (JSON object)</p>
        <textarea className={"input-text mono min-h-[7rem]"} value={value.argsJson} onChange={(e) => onChange({ ...value, argsJson: e.target.value })} />
      </div>
    </div>
  );
}
