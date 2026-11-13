import { screenTransaction } from "../src/screen";
import type { ConnectorAction } from "../src/actions/types";

declare const process: { argv: string[] };
const network = process.argv[2] === "testnet" ? "testnet" : "mainnet";
const receiverId = network === "mainnet" ? "wrap.near" : "wrap.testnet";
const transfer: ConnectorAction[] = [{ type: "Transfer", params: { deposit: "1" } }];
const swap: ConnectorAction[] = [{
  type: "FunctionCall",
  params: {
    methodName: "ft_transfer_call", gas: "1", deposit: "1",
    args: { receiver_id: "v2.ref-finance.near", amount: "1000000000000000000000000", msg: JSON.stringify({ actions: [{ pool_id: 1, token_in: "wrap.near", token_out: "usdt.tether-token.near", amount_in: "1000000000000000000000000", min_amount_out: "3000000" }] }) },
  },
}];
const time = async (receiver: string, actions: ConnectorAction[]) => {
  const start = performance.now();
  await screenTransaction({ receiverId: receiver, actions }, network, "latency.near", { contractFreshnessHours: 24 });
  return Math.round(performance.now() - start);
};

// A fresh process is a cold start: the block-height lookup is not cached yet.
// "Not.An.Account" skips the RPC checks, leaving only the local list and history work.
(async () => {
  const cold = await time(receiverId, transfer);
  const warm = await time(receiverId, transfer);
  const local = await time("Not.An.Account", transfer);
  const swapped = network === "mainnet" ? await time(receiverId, swap) : 0;
  console.log(`${cold} ${warm} ${local} ${swapped}`);
})();
