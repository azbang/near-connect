import type { ReactNode } from "react";
import type { ActionForm, ActionType } from "./types.ts";
import { ACTION_TYPES } from "./types.ts";

export function ActionCard(props: {
  index: number;
  total: number;
  value: ActionForm;
  onChange: (next: ActionForm) => void;
  onTypeChange: (type: ActionType) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { index, total, value, onChange, onTypeChange, onMove, onRemove, children } = props;

  return (
    <div className={"border border-[rgb(42,42,42)] rounded-lg p-3 flex flex-col gap-3"}>
      <div className={"flex flex-wrap items-end gap-2"}>
        <div className={"input-group grow min-w-[14rem]"}>
          <p className={"input-label"}>Type</p>
          <select className={"input-text"} value={value.type} onChange={(e) => onTypeChange(e.target.value as ActionType)}>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button className={"input-button compact"} onClick={() => onMove(-1)} disabled={index === 0}>
          Up
        </button>
        <button className={"input-button compact"} onClick={() => onMove(1)} disabled={index === total - 1}>
          Down
        </button>
        <button className={"input-button compact danger"} onClick={() => onRemove()}>
          Remove
        </button>
        <button className={"input-button compact"} onClick={() => onChange({ ...value, collapsed: !value.collapsed })}>
          {value.collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {value.collapsed ? null : children}
    </div>
  );
}
