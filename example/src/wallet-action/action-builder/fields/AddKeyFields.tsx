import type { AddKeyForm } from "../types.ts";

export function AddKeyFields(props: { value: AddKeyForm; onChange: (next: AddKeyForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
        <div className={"input-group"}>
          <p className={"input-label"}>Public key</p>
          <input className={"input-text"} value={value.publicKey} onChange={(e) => onChange({ ...value, publicKey: e.target.value })} />
        </div>
        <div className={"input-group"}>
          <p className={"input-label"}>Nonce (optional)</p>
          <input className={"input-text"} value={value.nonce} onChange={(e) => onChange({ ...value, nonce: e.target.value })} />
        </div>
        <div className={"input-group"}>
          <p className={"input-label"}>Permission</p>
          <select
            className={"input-text"}
            value={value.permissionType}
            onChange={(e) => onChange({ ...value, permissionType: e.target.value as "FullAccess" | "FunctionCall" })}
          >
            <option value={"FullAccess"}>FullAccess</option>
            <option value={"FunctionCall"}>FunctionCall</option>
          </select>
        </div>
      </div>

      {value.permissionType === "FunctionCall" && (
        <div className={"flex flex-col gap-2"}>
          <div className={"input-group"}>
            <p className={"input-label"}>ReceiverId</p>
            <input className={"input-text"} value={value.receiverId} onChange={(e) => onChange({ ...value, receiverId: e.target.value })} />
          </div>
          <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
            <div className={"input-group"}>
              <p className={"input-label"}>Allowance (NEAR)</p>
              <input className={"input-text"} value={value.allowanceNear} onChange={(e) => onChange({ ...value, allowanceNear: e.target.value })} />
            </div>
            <div className={"input-group"}>
              <p className={"input-label"}>Allowance (yocto, overrides NEAR)</p>
              <input className={"input-text"} value={value.allowanceYocto} onChange={(e) => onChange({ ...value, allowanceYocto: e.target.value })} />
            </div>
          </div>
          <div className={"input-group"}>
            <p className={"input-label"}>Method names (comma separated, optional)</p>
            <input className={"input-text"} value={value.methodNamesCsv} onChange={(e) => onChange({ ...value, methodNamesCsv: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
