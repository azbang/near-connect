import { useState } from "react";
import { IPropsWalletAction } from "./wallet-action.types.ts";

export const ResolveAuth = ({ wallet, network }: IPropsWalletAction) => {
  const [payload, setPayload] = useState("Approve withdrawal of 100 USDC to bob.near");
  const [recipient, setRecipient] = useState("example.app");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleResolveAuth = async (purpose: "PROVE_OWNERSHIP" | "APPROVE_OFFCHAIN_ACTION") => {
    if (!wallet.resolveAuth) {
      setError("This wallet does not support resolveAuth (NEP-641)");
      return;
    }
    setResult("");
    setError("");
    setLoading(true);
    try {
      const res = await wallet.resolveAuth({
        purpose,
        recipient,
        payload,
        network,
      });
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={"input-form"}>
      <p className={"input-form-label"}>NEP-641 Auth Resolve</p>
      <div className={"flex flex-col gap-3"}>
        <div className={"input-group"}>
          <p className={"input-label"}>Recipient (dApp domain)</p>
          <input
            className={"input-text"}
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        <div className={"input-group"}>
          <p className={"input-label"}>Payload</p>
          <input
            className={"input-text"}
            type="text"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </div>
        <div className={"flex gap-2"}>
          <button
            className={"input-button compact flex-1"}
            disabled={loading}
            onClick={() => handleResolveAuth("APPROVE_OFFCHAIN_ACTION")}
          >
            {loading ? "Signing..." : "Approve Action"}
          </button>
        </div>
        {result && (
          <details open className={"border border-[rgb(42,42,42)] rounded-lg p-3"}>
            <summary className={"cursor-pointer select-none text-left text-xs text-[rgb(126,130,144)]"}>
              Authorization result
            </summary>
            <pre
              className={"input-text mono mt-2 whitespace-pre-wrap break-all"}
              style={{ textAlign: "left", fontSize: "0.75rem" }}
            >
              {result}
            </pre>
          </details>
        )}
        {error && <p className={"text-left text-xs text-red-400"}>{error}</p>}
      </div>
    </div>
  );
};
