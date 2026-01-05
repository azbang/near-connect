import type { DeleteKeyForm } from "../types.ts";

export function DeleteKeyFields(props: { value: DeleteKeyForm; onChange: (next: DeleteKeyForm) => void }) {
  const { value, onChange } = props;

  return (
    <div className={"input-group"}>
      <p className={"input-label"}>Public key</p>
      <input className={"input-text"} value={value.publicKey} onChange={(e) => onChange({ ...value, publicKey: e.target.value })} />
    </div>
  );
}
