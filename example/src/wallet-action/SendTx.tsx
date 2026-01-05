import { useLocalStorage } from "usehooks-ts";
import { FinalExecutionOutcome } from "@near-js/types";

import { IPropsWalletAction } from "./wallet-action.types.ts";
import { FinalOutcome } from "./FinalOutcome.tsx";

import type { ActionForm, ActionType } from "./action-builder/types.ts";
import { ACTION_TYPES } from "./action-builder/types.ts";
import { ActionCard } from "./action-builder/ActionCard.tsx";
import { ActionFields } from "./action-builder/ActionFields.tsx";
import { buildConnectorAction, coerceActionForms, defaultActionForm, makeId, previewConnectorActions } from "./action-builder/helpers.ts";

export const SendTx = ({ wallet, network }: IPropsWalletAction) => {
  const [receiverId, setReceiverId] = useLocalStorage(`send-tx-${network}-receiver-id`, `demo.${network}`);
  const [newActionType, setNewActionType] = useLocalStorage<ActionType>(`send-tx-${network}-new-action-type`, "Transfer");
  const [lastResult, setLastResult] = useLocalStorage<FinalExecutionOutcome | undefined>(`send-tx-${network}-last-result`, undefined);
  const [actionsStored, setActionsStored] = useLocalStorage<unknown>(`send-tx-${network}-actions`, []);
  const [lastError, setLastError] = useLocalStorage<string>(`send-tx-${network}-last-error`, "");

  const actions = coerceActionForms(actionsStored, network);
  const setActions = (updater: (prev: ActionForm[]) => ActionForm[]) => {
    setActionsStored((prev: unknown) => updater(coerceActionForms(prev, network)));
  };

  const sendTx = async () => {
    setLastResult(undefined);
    setLastError("");
    try {
      const connectorActions = actions.map((a) => buildConnectorAction(a));
      const result = await wallet.signAndSendTransaction({ actions: connectorActions, receiverId });
      setLastResult(result);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  let payloadPreview: unknown = null;
  let previewError: string | null = null;
  try {
    const connectorActions = actions.map((a) => buildConnectorAction(a));
    payloadPreview = { receiverId, actions: previewConnectorActions(connectorActions) };
  } catch (e) {
    previewError = e instanceof Error ? e.message : String(e);
    payloadPreview = { receiverId, actions: [] };
  }

  return (
    <div className={"input-form"} style={{ width: 500 }}>
      <p className={"input-form-label"}>Send Transaction (Action Builder)</p>

      <div className={"flex flex-col gap-4"}>
        <div className={"flex flex-wrap gap-2 items-end"}>
          <div className={"input-group grow min-w-[18rem]"}>
            <p className={"input-label"}>Receiver Account</p>
            <input className={"input-text"} type={"text"} value={receiverId} onChange={(e) => setReceiverId(e.target.value)} />
          </div>
        </div>

        {actions.length > 0 && (
          <div className={"input-group"}>
            <p className={"input-label"}>Actions</p>
            <div className={"flex flex-col gap-2"}>
              {actions.map((a, idx) => {
                const move = (dir: -1 | 1) => {
                  setActions((prev) => {
                    const i = prev.findIndex((x) => x.id === a.id);
                    const j = i + dir;
                    if (i < 0 || j < 0 || j >= prev.length) return prev;
                    const out = [...prev];
                    const tmp = out[i];
                    out[i] = out[j];
                    out[j] = tmp;
                    return out;
                  });
                };

                const remove = () => setActions((prev) => prev.filter((x) => x.id !== a.id));
                const setA = (next: ActionForm) => setActions((prev) => prev.map((x) => (x.id === a.id ? next : x)));
                const setType = (type: ActionType) => setActions((prev) => prev.map((x) => (x.id === a.id ? defaultActionForm(type, a.id, network) : x)));

                return (
                  <ActionCard key={a.id} index={idx} total={actions.length} value={a} onChange={setA} onTypeChange={setType} onMove={move} onRemove={remove}>
                    <ActionFields value={a} onChange={setA} />
                  </ActionCard>
                );
              })}
            </div>
          </div>
        )}

        <div className={"input-group w-[14rem]"}>
          <p className={"input-label"}>New action</p>
          <select className={"input-text"} value={newActionType} onChange={(e) => setNewActionType(e.target.value as ActionType)}>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className={"flex flex-wrap gap-2 items-end"}>
            <button
              className={"input-button compact flex-1"}
              onClick={() => setActions((prev) => [...prev, defaultActionForm(newActionType, makeId(), network)])}
            >
              Add
            </button>
            <button className={"input-button compact flex-1"} onClick={() => setActions(() => [defaultActionForm("Transfer", makeId(), network)])}>
              Reset
            </button>
          </div>
        </div>

        <details className={"border border-[rgb(42,42,42)] rounded-lg p-3"}>
          <summary className={"cursor-pointer select-none text-left text-xs text-[rgb(126,130,144)]"}>Payload preview</summary>
          <pre className={"input-text mono mt-2 whitespace-pre-wrap break-all"} style={{ textAlign: "left" }}>
            {JSON.stringify(payloadPreview, null, 2)}
          </pre>
        </details>

        <div className={"flex w-full"}>
          <button className={"input-button w-full"} onClick={() => sendTx()}>
            Send tx
          </button>
        </div>

        {previewError ? <p className={"text-left text-xs text-amber-400"}>Preview error: {previewError}</p> : null}
        {lastError ? <p className={"text-left text-xs text-red-400"}>{lastError}</p> : null}
        {lastResult != null && <FinalOutcome outcome={lastResult} network={network} />}
      </div>
    </div>
  );
};
