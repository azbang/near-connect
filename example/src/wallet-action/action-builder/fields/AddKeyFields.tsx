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
        <label className={"input-group md:col-span-2"}>
          <p className={"input-label"}>Gas key info</p>
          <span className={"flex items-center gap-2 text-left"}>
            <input
              type={"checkbox"}
              checked={value.enableGasKeyInfo}
              onChange={(e) => onChange({ ...value, enableGasKeyInfo: e.target.checked })}
            />
            <span>Include gas key balance and nonce allocation</span>
          </span>
        </label>
      </div>

      {value.enableGasKeyInfo && (
        <div className={"grid grid-cols-1 md:grid-cols-2 gap-3"}>
          <div className={"input-group"}>
            <p className={"input-label"}>Gas balance (NEAR)</p>
            <input className={"input-text"} value={value.gasBalanceNear} onChange={(e) => onChange({ ...value, gasBalanceNear: e.target.value })} />
          </div>
          <div className={"input-group"}>
            <p className={"input-label"}>Gas balance (yocto, overrides NEAR)</p>
            <input className={"input-text"} value={value.gasBalanceYocto} onChange={(e) => onChange({ ...value, gasBalanceYocto: e.target.value })} />
          </div>
          <div className={"input-group"}>
            <p className={"input-label"}>Num nonces</p>
            <input className={"input-text"} value={value.numNonces} onChange={(e) => onChange({ ...value, numNonces: e.target.value })} />
          </div>
        </div>
      )}

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
