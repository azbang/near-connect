import type { UseGlobalContractForm } from "../types.ts";

const isBase58 = (s: string) => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);

export function UseGlobalContractFields(props: { value: UseGlobalContractForm; onChange: (next: UseGlobalContractForm) => void }) {
  const { value, onChange } = props;
  const codeHashTrimmed = value.codeHash.trim();
  const codeHashValid = !codeHashTrimmed || isBase58(codeHashTrimmed);

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"input-group"}>
        <p className={"input-label"}>Identifier type</p>
        <select
          className={"input-text"}
          value={value.identifierType}
          onChange={(e) => onChange({ ...value, identifierType: e.target.value as "AccountId" | "CodeHash" })}
        >
          <option value={"AccountId"}>AccountId</option>
          <option value={"CodeHash"}>CodeHash</option>
        </select>
      </div>

      {value.identifierType === "AccountId" ? (
        <div className={"input-group"}>
          <p className={"input-label"}>AccountId</p>
          <input className={"input-text"} value={value.accountId} onChange={(e) => onChange({ ...value, accountId: e.target.value })} />
        </div>
      ) : (
        <div className={"input-group"}>
          <p className={"input-label"}>CodeHash (base58)</p>
          <input className={"input-text mono"} value={value.codeHash} onChange={(e) => onChange({ ...value, codeHash: e.target.value })} />
          {!codeHashValid ? <p className={"text-left text-xs text-amber-400"}>Expected base58 string (no 0/O/I/l chars).</p> : null}
        </div>
      )}
    </div>
  );
}
