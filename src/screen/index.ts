import fallback from "./sanctioned-addresses-2026-11-09.json";
import { html } from "../helpers/html";
import { Popup } from "../popups/Popup";
import type { Network, ScreenOptions, SignAndSendTransactionParams } from "../types";
import type { ConnectorAction } from "../actions/types";

export interface ScreenCheck {
  level: "block" | "warn" | "ok";
  reason: string;
  evidence_url: string;
}

interface AddressList {
  version: string;
  source?: string;
  addresses: Array<{ address: string; currency?: string; name?: string }>;
}

const OFAC_URL = "https://ofac.treasury.gov/sanctions-list-service";
const EXPLORER = {
  mainnet: "https://nearblocks.io/address/",
  testnet: "https://testnet.nearblocks.io/address/",
};
const RPC = {
  mainnet: "https://rpc.mainnet.fastnear.com",
  testnet: "https://near-testnet.drpc.org",
};
const recentHeights = new Map<string, { height: number; timestamp: number }>();

export class ScreenBlockedError extends Error {
  constructor(readonly checks: ScreenCheck[]) {
    super(checks.map((check) => check.reason).join("\n"));
    this.name = "ScreenBlockedError";
  }
}

class ScreenWarningPopup extends Popup<{}> {
  constructor(readonly delegate: { reason: string; explanation?: string; onAccept: () => void; onReject: () => void }) {
    super(delegate);
  }

  handlers() {
    super.handlers();
    this.root.querySelector(".modal-content")?.setAttribute("role", "alertdialog");
    this.root.querySelector(".modal-content")?.setAttribute("aria-modal", "true");
    this.root.querySelector(".modal-content")?.setAttribute("aria-labelledby", "screen-warning-title");
    this.root.querySelector(".modal-content")?.setAttribute("aria-describedby", "screen-warning-reason");
    this.addListener(".screen-continue", "click", () => {
      this.delegate.onAccept();
      this.destroy();
    });
    this.addListener(".screen-cancel", "click", () => {
      this.delegate.onReject();
      this.destroy();
    });
    this.addListener(".modal-content", "keydown", (event) => {
      if ((event as KeyboardEvent).key !== "Tab") return;
      const focusable = Array.from(this.root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if ((event as KeyboardEvent).shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!(event as KeyboardEvent).shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  get dom() {
    return html`<div class="modal-container"><div class="modal-content">
      <div class="modal-header"><p id="screen-warning-title">Transaction warning</p></div>
      <div class="modal-body"><p id="screen-warning-reason">${this.delegate.reason}</p>${this.delegate.explanation ? html`<p>${this.delegate.explanation}</p>` : ""}
        <button class="screen-continue">Continue anyway</button><button class="screen-cancel">Cancel</button>
      </div>
    </div></div>`;
  }
}

const addressList = async (listUrl?: string): Promise<AddressList> => {
  if (listUrl) {
    try {
      const response = await fetch(listUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const list = (await response.json()) as AddressList;
        if (Array.isArray(list.addresses) && list.addresses.every((entry) => typeof entry.address === "string")) return list;
      }
    } catch {
      // A failed list refresh uses the bundled Treasury snapshot.
    }
  }
  return fallback as AddressList;
};

const sameAddress = (a: string, b: string) => {
  const lowerCase = (value: string) => /^0x/i.test(value) || value.toLowerCase().startsWith("bc1");
  return lowerCase(a) && lowerCase(b) ? a.toLowerCase() === b.toLowerCase() : a === b;
};

const recipients = (receiverId: string, actions: ConnectorAction[]) => {
  const found = new Set([receiverId]);
  for (const action of actions) {
    if (action.type !== "FunctionCall" || !/(withdraw|transfer)/i.test(action.params.methodName)) continue;
    const args = action.params.args as Record<string, unknown>;
    for (const key of ["receiver_id", "receiverId", "recipient", "destination"]) {
      if (typeof args?.[key] === "string") found.add(args[key] as string);
    }
  }
  return [...found];
};

const isNearAccountId = (value: string) => value.length <= 64 && /^(?:[a-z0-9]+[._-])*[a-z0-9]+$/.test(value);

const request = async (url: string, method: string, params: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "near-connect-screen", method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.cause?.name ?? data.error.message ?? "RPC error");
  return data.result;
};

const blockAtTimestamp = async (url: string, latestHeight: number, timestamp: number) => {
  const key = `${url}:${Math.round(timestamp / 3600000)}`;
  const cached = recentHeights.get(key);
  if (cached && Date.now() - cached.timestamp < 30000) return cached.height;
  let low = Math.max(1, latestHeight - 172800);
  let lowBlock = await request(url, "block", { block_id: low });
  while (Number(lowBlock.header.timestamp_nanosec) / 1e6 > timestamp && low > 1) {
    low = Math.max(1, low - (latestHeight - low));
    lowBlock = await request(url, "block", { block_id: low });
  }
  let high = latestHeight;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const block = await request(url, "block", { block_id: mid });
    if (Number(block.header.timestamp_nanosec) / 1e6 < timestamp) low = mid;
    else high = mid;
  }
  recentHeights.set(key, { height: high, timestamp: Date.now() });
  return high;
};

const contractChecks = async (accountId: string, network: Network, hours: number): Promise<ScreenCheck[]> => {
  const url = RPC[network];
  const evidence = `${EXPLORER[network]}${encodeURIComponent(accountId)}`;
  try {
    const latest = await request(url, "block", { finality: "final" });
    const targetTime = Number(latest.header.timestamp_nanosec) / 1e6 - hours * 3600000;
    const oldHeight = await blockAtTimestamp(url, latest.header.height, targetTime);
    const viewAccount = (block: Record<string, unknown>) => request(url, "query", { request_type: "view_account", account_id: accountId, ...block });
    const [currentAccount, oldAccount] = await Promise.allSettled([
      viewAccount({ finality: "final" }),
      viewAccount({ block_id: oldHeight }),
    ]);
    if (currentAccount.status === "rejected") {
      if (String(currentAccount.reason).includes("UNKNOWN_ACCOUNT")) return [{ level: "ok", reason: "Receiver account is not currently active.", evidence_url: evidence }];
      throw currentAccount.reason;
    }
    const checks: ScreenCheck[] = [];
    if (oldAccount.status === "rejected") {
      if (String(oldAccount.reason).includes("UNKNOWN_ACCOUNT")) checks.push({ level: "warn", reason: `Receiver account was created within the last ${hours} hours.`, evidence_url: evidence });
      else throw oldAccount.reason;
    }

    const viewCode = (block: Record<string, unknown>) => request(url, "query", { request_type: "view_code", account_id: accountId, ...block }).catch((error) => {
      if (String(error).includes("NO_CONTRACT_CODE") || String(error).includes("UNKNOWN_ACCOUNT")) return null;
      throw error;
    });
    const [currentCode, oldCode] = await Promise.all([
      viewCode({ finality: "final" }),
      viewCode({ block_id: oldHeight }),
    ]);
    if ((currentCode?.hash ?? null) !== (oldCode?.hash ?? null)) {
      checks.push({ level: "warn", reason: `Receiver contract code changed within the last ${hours} hours.`, evidence_url: evidence });
    }
    return checks.length ? checks : [{ level: "ok", reason: "Receiver account and contract are unchanged across the freshness window.", evidence_url: evidence }];
  } catch (error) {
    return [{ level: "warn", reason: `Contract freshness could not be verified: ${String(error)}`, evidence_url: `${url}` }];
  }
};

const explain = async (apiKey: string, checks: ScreenCheck[]) => {
  try {
    const modelsResponse = await fetch("https://cloud-api.near.ai/v1/models", {
      headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000),
    });
    if (!modelsResponse.ok) return undefined;
    const models = await modelsResponse.json();
    const model = models.data?.[0]?.id;
    if (!model) return undefined;
    const response = await fetch("https://cloud-api.near.ai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: `Explain these transaction screening findings in one plain-language paragraph. Do not change their severity or claim unverified facts: ${JSON.stringify(checks)}` }], max_tokens: 160 }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.choices?.[0]?.message?.content as string | undefined;
  } catch {
    return undefined;
  }
};

const historyKey = (network: Network, signerId: string) => `near-connect-screen:${network}:${signerId}`;

const readHistory = (network: Network, signerId: string) => {
  try {
    return JSON.parse(localStorage.getItem(historyKey(network, signerId)) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const writeHistory = (network: Network, signerId: string, values: string[]) => {
  try {
    const next = [...new Set([...readHistory(network, signerId), ...values])].slice(-500);
    localStorage.setItem(historyKey(network, signerId), JSON.stringify(next));
  } catch {
    // Storage may be disabled; screening still works without address history.
  }
};

export const screenAddressChecks = (
  destinations: string[],
  previous: string[],
  list: AddressList = fallback as AddressList,
  network: Network = "mainnet",
): ScreenCheck[] => {
  const checks: ScreenCheck[] = [];
  for (const recipient of destinations) {
    const sanctioned = list.addresses.find((entry) => sameAddress(entry.address, recipient));
    if (sanctioned) {
      checks.push({ level: "block", reason: `Recipient is listed by OFAC as ${sanctioned.name ?? "a sanctioned entity"} (${sanctioned.currency ?? "digital currency"}).`, evidence_url: list.source ?? OFAC_URL });
    }
  }
  for (const recipient of destinations) {
    if (previous.some((address) => !sameAddress(address, recipient) && address.slice(0, 4) === recipient.slice(0, 4) && address.slice(-4) === recipient.slice(-4))) {
      checks.push({ level: "block", reason: `Recipient ${recipient} resembles an address you used before but is different.`, evidence_url: EXPLORER[network] + encodeURIComponent(recipient) });
    }
  }
  return checks;
};

export const screenTransaction = async (
  tx: Pick<SignAndSendTransactionParams, "receiverId" | "actions">,
  network: Network,
  signerId: string,
  options: ScreenOptions,
): Promise<ScreenCheck[]> => {
  const list = await addressList(options.listUrl);
  const destinations = recipients(tx.receiverId, tx.actions as ConnectorAction[]);
  const previous = readHistory(network, signerId);
  const checks = screenAddressChecks(destinations, previous, list, network);

  const age = options.contractFreshnessHours ?? 24;
  if (isNearAccountId(tx.receiverId)) checks.push(...await contractChecks(tx.receiverId, network, age));
  if (!checks.length) checks.push({ level: "ok", reason: `No known-bad recipient or recent contract change found. List version ${list.version}.`, evidence_url: list.source ?? OFAC_URL });
  return checks;
};

export const approveScreen = async (checks: ScreenCheck[], options: ScreenOptions) => {
  const blocks = checks.filter((check) => check.level === "block");
  if (blocks.length) throw new ScreenBlockedError(blocks);
  const warnings = checks.filter((check) => check.level === "warn");
  if (!warnings.length) return;
  const reason = warnings.map((check) => `${check.reason} (${check.evidence_url})`).join("\n\n");
  const explanation = options.nearAi ? await explain(options.nearAi.apiKey, warnings) : undefined;
  if (typeof document === "undefined") throw new ScreenBlockedError(warnings);
  const previousFocus = document.activeElement as HTMLElement | null;
  await new Promise<void>((resolve, reject) => {
    const popup = new ScreenWarningPopup({ reason, explanation, onAccept: resolve, onReject: () => reject(new Error(reason)) });
    popup.create({ show: true });
    popup.root.querySelector<HTMLButtonElement>(".screen-continue")?.focus();
  }).finally(() => previousFocus?.focus());
};

export const screenAndSend = async <T>(
  options: ScreenOptions | undefined,
  txs: Array<Pick<SignAndSendTransactionParams, "receiverId" | "actions">>,
  network: Network,
  signerId: string,
  send: () => Promise<T>,
) => {
  if (!options) return send();
  const checks = (await Promise.all(txs.map((tx) => screenTransaction(tx, network, signerId, options)))).flat();
  await approveScreen(checks, options);
  const result = await send();
  writeHistory(network, signerId, txs.flatMap((tx) => recipients(tx.receiverId, tx.actions as ConnectorAction[])));
  return result;
};
