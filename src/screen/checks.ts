import type { ConnectorAction } from "../actions/types";
import type { ScreenCheck } from "./index";

const ONE_NEAR = 10n ** 24n;
const WIDE_METHOD_LIST = 5;
const PRICES_URL = "https://coins.llama.fi/prices/current/";

// Well-known mainnet contracts. A different account that looks like one of them is a classic
// phishing receiver. Subaccounts of a listed contract belong to its owner and are not flagged.
const CANONICAL = ["intents.near", "wrap.near", "v2.ref-finance.near", "usdt.tether-token.near"];

const skeleton = (id: string) =>
  id.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/[1i]/g, "l").replace(/[-_.]/g, "");

const withinOneEdit = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0));
};

// One edit is only a safe signal on longer ids: `swap.near` is one edit from `wrap.near` and is its own account.
export const lookalikeContractChecks = (destinations: string[], explorer: string): ScreenCheck[] =>
  destinations.flatMap((id) => {
    const target = CANONICAL.find((known) => id !== known && !id.endsWith(`.${known}`) && (skeleton(id) === skeleton(known) || (known.length >= 12 && withinOneEdit(id, known))));
    return target ? [{ level: "block" as const, reason: `Recipient ${id} resembles ${target} but is a different account.`, evidence_url: explorer + encodeURIComponent(id) }] : [];
  });

export const accessKeyChecks = (receiverId: string, actions: ConnectorAction[], explorer: string): ScreenCheck[] =>
  actions.flatMap((action): ScreenCheck[] => {
    if (action.type !== "AddKey") return [];
    const evidence_url = explorer + encodeURIComponent(receiverId);
    const { permission } = action.params.accessKey;
    if (permission === "FullAccess") {
      return [{ level: "block", reason: `This transaction adds a full-access key to ${receiverId}, which gives the key holder complete control of the account.`, evidence_url }];
    }
    const findings = [];
    if (!permission.methodNames?.length || permission.methodNames.length > WIDE_METHOD_LIST) findings.push("can call many methods");
    if (permission.allowance === undefined || !/^\d+$/.test(permission.allowance) || BigInt(permission.allowance) > ONE_NEAR) findings.push("has no gas allowance limit or one above 1 NEAR");
    return findings.length ? [{ level: "warn", reason: `The function-call key added to ${receiverId} ${findings.join(" and ")}.`, evidence_url }] : [];
  });

export interface Swap { tokenIn: string; amountIn: string; tokenOut: string; minAmountOut: string }
export type Prices = Record<string, { price: number; decimals: number }>;

// Ref Finance swaps are `ft_transfer_call` to the exchange with a JSON `msg` listing the route.
// The input is the transferred token and amount; the output is the route's final token and its minimum.
export const swapsIn = (receiverId: string, actions: ConnectorAction[]): Swap[] =>
  actions.flatMap((action) => {
    if (action.type !== "FunctionCall" || action.params.methodName !== "ft_transfer_call") return [];
    const args = action.params.args as { amount?: unknown; msg?: unknown };
    try {
      const route: Array<{ token_out?: string; min_amount_out?: string }> = JSON.parse(args.msg as string).actions;
      const last = route[route.length - 1];
      if (typeof args.amount !== "string" || !last?.token_out) return [];
      const minAmountOut = route.filter((step) => step.token_out === last.token_out).reduce((sum, step) => sum + BigInt(step.min_amount_out ?? "0"), 0n);
      return [{ tokenIn: receiverId, amountIn: args.amount, tokenOut: last.token_out, minAmountOut: minAmountOut.toString() }];
    } catch {
      return []; // not a swap message
    }
  });

export const fetchPrices = async (tokens: string[]): Promise<Prices> => {
  try {
    const response = await fetch(`${PRICES_URL}${tokens.map((token) => `near:${token}`).join(",")}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return {};
    const { coins } = await response.json();
    return Object.fromEntries(Object.entries(coins as Record<string, { price: number; decimals: number }>).map(([key, coin]) => [key.replace(/^near:/, ""), coin]));
  } catch {
    return {};
  }
};

export const swapChecks = (swaps: Swap[], prices: Prices, maxLossPercent: number, explorer: string): ScreenCheck[] =>
  swaps.flatMap((swap) => {
    const [input, output] = [prices[swap.tokenIn], prices[swap.tokenOut]];
    if (!input || !output) return [];
    const valueIn = (Number(swap.amountIn) / 10 ** input.decimals) * input.price;
    const valueOut = (Number(swap.minAmountOut) / 10 ** output.decimals) * output.price;
    const loss = (1 - valueOut / valueIn) * 100;
    return loss > maxLossPercent
      ? [{ level: "warn" as const, reason: `The swap accepts at least $${valueOut.toFixed(2)} out for $${valueIn.toFixed(2)} in, a possible loss of ${Math.round(loss)}%.`, evidence_url: explorer + encodeURIComponent(swap.tokenOut) }]
      : [];
  });
