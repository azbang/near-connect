import type { DeployGlobalContractForm } from "../types.ts";
import { base64FromBytes } from "../helpers.ts";

export function DeployGlobalContractFields(props: { value: DeployGlobalContractForm; onChange: (next: DeployGlobalContractForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"input-group"}>
        <p className={"input-label"}>WASM code (base64)</p>
        <textarea className={"input-text mono min-h-[6rem]"} value={value.codeBase64} onChange={(e) => onChange({ ...value, codeBase64: e.target.value })} />
      </div>
      <div className={"input-group"}>
        <p className={"input-label"}>Load .wasm file</p>
        <input
          className={"input-text"}
          type={"file"}
          accept={".wasm,application/wasm"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const bytes = new Uint8Array(await file.arrayBuffer());
            onChange({ ...value, codeBase64: base64FromBytes(bytes) });
          }}
        />
      </div>

      <div className={"input-group"}>
        <p className={"input-label"}>Deploy mode</p>
        <select
          className={"input-text"}
          value={value.deployMode}
          onChange={(e) => onChange({ ...value, deployMode: e.target.value as "AccountId" | "CodeHash" })}
        >
          <option value={"AccountId"}>AccountId</option>
          <option value={"CodeHash"}>CodeHash</option>
        </select>
      </div>
    </div>
  );
}
