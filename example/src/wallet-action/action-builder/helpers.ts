import { parseNearAmount } from "@near-js/utils";
import type { ConnectorAction } from "@hot-labs/near-connect";
import { ACTION_TYPES } from "./types.ts";
import type { ActionForm, ActionType, Network } from "./types.ts";

export const makeId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const toYocto = (near: string) => parseNearAmount(near)?.toString() ?? "0";

export const bytesFromBase64 = (base64: string) => {
  const s = base64.trim();
  if (!s) return new Uint8Array();
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const base64FromBytes = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

export const parseJsonObject = (json: string): object => {
  const trimmed = json.trim();
  if (!trimmed) return {};
  const value = JSON.parse(trimmed) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("args must be a JSON object");
  }
  return value as object;
};

export const defaultActionForm = (type: ActionType, id = makeId(), network: Network = "testnet"): ActionForm => {
  switch (type) {
    case "CreateAccount":
      return { id, type, collapsed: false };
    case "DeployContract":
      return { id, type, collapsed: false, codeBase64: "" };
    case "FunctionCall":
      return {
        id,
        type,
        collapsed: false,
        methodName: "storage_deposit",
        argsJson: JSON.stringify({ account_id: `demo.${network}` }, null, 2),
        gas: "30000000000000",
        depositNear: "0",
        depositYocto: "",
      };
    case "Transfer":
      return { id, type, collapsed: false, depositNear: "0.01", depositYocto: "" };
    case "Stake":
      return { id, type, collapsed: false, stakeNear: "0", stakeYocto: "", publicKey: "" };
    case "AddKey":
      return {
        id,
        type,
        collapsed: false,
        publicKey: "",
        nonce: "",
        permissionType: "FullAccess",
        receiverId: `demo.${network}`,
        allowanceNear: "0",
        allowanceYocto: "",
        methodNamesCsv: "",
      };
    case "DeleteKey":
      return { id, type, collapsed: false, publicKey: "" };
    case "DeleteAccount":
      return { id, type, collapsed: false, beneficiaryId: `demo.${network}` };
    case "UseGlobalContract":
      return { id, type, collapsed: false, identifierType: "AccountId", accountId: `demo.${network}`, codeHash: "" };
    case "DeployGlobalContract":
      return { id, type, collapsed: false, codeBase64: "", deployMode: "AccountId" };
  }
};

export const buildConnectorAction = (a: ActionForm): ConnectorAction => {
  switch (a.type) {
    case "CreateAccount":
      return { type: "CreateAccount" };
    case "DeployContract":
      return { type: "DeployContract", params: { code: bytesFromBase64(a.codeBase64) } };
    case "FunctionCall":
      return {
        type: "FunctionCall",
        params: {
          methodName: a.methodName,
          args: parseJsonObject(a.argsJson),
          gas: a.gas,
          deposit: a.depositYocto.trim() ? a.depositYocto.trim() : toYocto(a.depositNear),
        },
      };
    case "Transfer":
      return {
        type: "Transfer",
        params: { deposit: a.depositYocto.trim() ? a.depositYocto.trim() : toYocto(a.depositNear) },
      };
    case "Stake":
      return {
        type: "Stake",
        params: { stake: a.stakeYocto.trim() ? a.stakeYocto.trim() : toYocto(a.stakeNear), publicKey: a.publicKey },
      };
    case "AddKey": {
      const nonce = a.nonce.trim() ? Number(a.nonce.trim()) : undefined;
      if (a.permissionType === "FullAccess") {
        return { type: "AddKey", params: { publicKey: a.publicKey, accessKey: { nonce, permission: "FullAccess" } } };
      }
      const methodNames = a.methodNamesCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const allowance = a.allowanceYocto.trim() ? a.allowanceYocto.trim() : toYocto(a.allowanceNear);
      return {
        type: "AddKey",
        params: {
          publicKey: a.publicKey,
          accessKey: {
            nonce,
            permission: {
              receiverId: a.receiverId,
              allowance: allowance === "0" ? undefined : allowance,
              methodNames: methodNames.length ? methodNames : undefined,
            },
          },
        },
      };
    }
    case "DeleteKey":
      return { type: "DeleteKey", params: { publicKey: a.publicKey } };
    case "DeleteAccount":
      return { type: "DeleteAccount", params: { beneficiaryId: a.beneficiaryId } };
    case "UseGlobalContract":
      return {
        type: "UseGlobalContract",
        params: {
          contractIdentifier: a.identifierType === "AccountId" ? { accountId: a.accountId.trim() } : { codeHash: a.codeHash.trim() },
        },
      };
    case "DeployGlobalContract":
      return {
        type: "DeployGlobalContract",
        params: { code: bytesFromBase64(a.codeBase64), deployMode: a.deployMode },
      };
  }
};

export const previewActions = (forms: ActionForm[]) => {
  return forms.map((a) => {
    if (a.type === "DeployContract") return { ...a, codeBase64: a.codeBase64 ? `<base64 ${a.codeBase64.length} chars>` : "" };
    if (a.type === "DeployGlobalContract") return { ...a, codeBase64: a.codeBase64 ? `<base64 ${a.codeBase64.length} chars>` : "" };
    return a;
  });
};

export const previewConnectorActions = (actions: ConnectorAction[]) => {
  return actions.map((a) => {
    if (a.type === "DeployContract") {
      return { ...a, params: { ...a.params, code: `<bytes ${a.params.code.length}>` } } as unknown;
    }
    if (a.type === "DeployGlobalContract") {
      return { ...a, params: { ...a.params, code: `<bytes ${a.params.code.length}>` } } as unknown;
    }
    return a as unknown;
  });
};

const isActionForm = (value: unknown): value is ActionForm => {
  if (value == null || typeof value !== "object") return false;
  const anyV = value as any;
  return typeof anyV.id === "string" && typeof anyV.type === "string" && (ACTION_TYPES as string[]).includes(anyV.type);
};

export const coerceActionForms = (value: unknown, network: Network): ActionForm[] => {
  if (Array.isArray(value) && value.every(isActionForm)) return value;
  if (!Array.isArray(value)) return [defaultActionForm("Transfer", makeId(), network)];

  const out: ActionForm[] = [];
  for (const raw of value) {
    if (raw == null || typeof raw !== "object") continue;
    const anyRaw = raw as any;
    const id = typeof anyRaw.id === "string" ? anyRaw.id : makeId();
    const type = anyRaw.type as ActionType;
    if (typeof type !== "string") continue;
    try {
      const base = defaultActionForm(type, id, network) as any;
      // Merge best-effort known keys (keeps backwards compatibility for localStorage)
      out.push({ ...base, ...anyRaw, id, type });
    } catch {
      // ignore unknown action types
    }
  }
  return out.length ? out : [defaultActionForm("Transfer", makeId(), network)];
};
