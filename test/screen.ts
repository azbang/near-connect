import fallback from "../src/screen/sanctioned-addresses-2026-11-09.json";
import nearAccounts from "../src/screen/near-account-addresses-2026-11-01.json";
import { accessKeyChecks, lookalikeContractChecks, fetchPrices, swapChecks, swapsIn } from "../src/screen/checks";
import { approveScreen, screenAddressChecks, screenAndSend, screenTransaction, ScreenBlockedError } from "../src/screen";
import type { ConnectorAction } from "../src/actions/types";

declare const process: { env: Record<string, string | undefined>; exitCode?: number };
const store = new Map<string, string>();
// Node has no localStorage; the address history needs the browser API.
(globalThis as any).localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };
const assert: (condition: unknown, message?: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message ?? "Assertion failed");
};

const sanctioned = fallback.addresses.find((entry) => entry.currency === "XBT");
assert(sanctioned, "bundled Treasury list contains a real XBT address");
const ofac = screenAddressChecks([sanctioned.address], []);
assert(ofac.length === 1);
assert(ofac[0].level === "block");
assert(ofac[0].evidence_url.includes(".treas.gov"));

const clean = screenAddressChecks(["clean-recipient.near"], []);
assert(clean.length === 0, `a recipient absent from the actual list passes the address check: ${JSON.stringify(clean)}`);

const poison = screenAddressChecks(["0xa12345678901234567890123456789012345cdef"], ["0xa19876543210987654321098765432109876cdef"]);
assert(poison.length === 1);
assert(poison[0].level === "block");
assert(poison[0].reason.includes("resembles an address you used before"));
assert(!screenAddressChecks(["0xa12345678901234567890123456789012345cdef"], ["0xa12345678901234567890123456789012345CDEF"]).length, "the same address in another case is not a lookalike");
assert(!screenAddressChecks(["0xa12345678901234567890123456789012345cdef"], ["0xb19876543210987654321098765432109876cdef"]).length, "a different first 4 characters is not a lookalike");
assert(!screenAddressChecks(["abcdwxyz1.near"], ["abcdqrstu.near"]).length, "named accounts that only share a prefix and the .near suffix are not lookalikes");
assert(screenAddressChecks(["alice-treasury-vault.near"], ["alice-treasury-vault-x.near"]).length === 0, "a named account differing in its last characters is not a lookalike");
assert(screenAddressChecks(["alice-vault-a-main.near"], ["alice-vault-b-main.near"])[0]?.level === "block", "named lookalike with the same first and last 4 characters is blocked");

assert(nearAccounts.version && nearAccounts.addresses.length > 0, "bundled NEAR account list is versioned and has entries");
const flagged = screenAddressChecks([nearAccounts.addresses[0].address], []);
assert(flagged.length === 1 && flagged[0].level === nearAccounts.addresses[0].level, JSON.stringify(flagged));
assert(flagged[0].evidence_url.startsWith("https://github.com/"), "a NEAR list match carries its evidence link");

const list = (entries: object[]) => `data:application/json,${encodeURIComponent(JSON.stringify({ version: "test", addresses: entries }))}`;
const tx = (receiverId: string) => ({ receiverId, actions: [{ type: "Transfer", params: { deposit: "1" } }] as ConnectorAction[] });
const explorer = "https://nearblocks.io/address/";
for (const id of ["intents.nearr", "lntents.near", "intents-near", "intent.near", "vvrap.near", "v2.ref-flnance.near", "usdt.tether-tokn.near"]) {
  assert(lookalikeContractChecks([id], explorer)[0]?.level === "block", `${id} is blocked as a look-alike of a well-known contract`);
}
for (const id of ["intents.near", "wrap.near", "swap.near", "x.intents.near", "alice.near"]) {
  assert(!lookalikeContractChecks([id], explorer).length, `${id} is not a look-alike`);
}

const addKey = (permission: "FullAccess" | { receiverId: string; allowance?: string; methodNames?: string[] }) => [{ type: "AddKey", params: { publicKey: "ed25519:x", accessKey: { permission } } }] as ConnectorAction[];
assert(accessKeyChecks("alice.near", addKey("FullAccess"), explorer)[0]?.level === "block", "a full-access key is blocked");
assert(!accessKeyChecks("alice.near", addKey({ receiverId: "app.near", allowance: "250000000000000000000000", methodNames: ["get", "set"] }), explorer).length, "a narrow function-call key passes");
assert(accessKeyChecks("alice.near", addKey({ receiverId: "app.near", allowance: "250000000000000000000000" }), explorer)[0]?.level === "warn", "a key for any method warns");
assert(accessKeyChecks("alice.near", addKey({ receiverId: "app.near", methodNames: ["get"] }), explorer)[0]?.level === "warn", "a key with no allowance limit warns");
assert(accessKeyChecks("alice.near", addKey({ receiverId: "app.near", allowance: "5000000000000000000000000", methodNames: ["get"] }), explorer)[0]?.level === "warn", "a key with a 5 NEAR allowance warns");
assert(accessKeyChecks("alice.near", [{ type: "Transfer", params: { deposit: "1" } }], explorer).length === 0);

const route = { actions: [{ pool_id: 1, token_in: "wrap.near", token_out: "usdt.tether-token.near", amount_in: "1000000000000000000000000", min_amount_out: "1000000" }] };
const swapCall = (msg: string) => [{ type: "FunctionCall", params: { methodName: "ft_transfer_call", gas: "1", deposit: "1", args: { receiver_id: "v2.ref-finance.near", amount: "1000000000000000000000000", msg } } }] as ConnectorAction[];
const swaps = swapsIn("wrap.near", swapCall(JSON.stringify(route)));
assert(swaps.length === 1 && swaps[0].tokenOut === "usdt.tether-token.near" && swaps[0].minAmountOut === "1000000", JSON.stringify(swaps));
assert(!swapsIn("wrap.near", swapCall("not json")).length && !swapsIn("wrap.near", swapCall("{}")).length, "a plain transfer message is not a swap");
const prices = { "wrap.near": { price: 3.5, decimals: 24 }, "usdt.tether-token.near": { price: 1, decimals: 6 } };
assert(swapChecks(swaps, prices, 20, explorer)[0]?.level === "warn", "1 NEAR ($3.50) swapped for a $1 minimum warns");
assert(!swapChecks([{ ...swaps[0], minAmountOut: "3400000" }], prices, 20, explorer).length, "a $3.40 minimum for $3.50 passes");
assert(!swapChecks(swaps, {}, 20, explorer).length, "no price data means no swap warning");

const main = async () => {
  const addedKey = await screenTransaction({ receiverId: "alice.near", actions: addKey("FullAccess") }, "mainnet", "key-test", {});
  assert(addedKey.length === 1 && addedKey[0].level === "block", JSON.stringify(addedKey));
  const fetched = await screenTransaction(tx("fetched-scam.near"), "mainnet", "list-test", { nearAccountListUrl: list([{ address: "fetched-scam.near", level: "block" }]) });
  assert(fetched.length === 1 && fetched[0].level === "block", `a configured NEAR list URL is used: ${JSON.stringify(fetched)}`);
  for (const bad of ["http://127.0.0.1:1/", `data:application/json,${encodeURIComponent(JSON.stringify({ addresses: [] }))}`, "data:application/json,not-json"]) {
    const fell = await screenTransaction(tx(sanctioned.address), "mainnet", "list-test", { listUrl: bad });
    assert(fell.some((check) => check.level === "block"), `unreachable or invalid list falls back to the bundled OFAC list: ${bad}`);
  }
  await approveScreen([{ level: "block", reason: "x", evidence_url: "u" }], {}).then(() => assert(false, "block must stop the send"), (error) => assert(error instanceof ScreenBlockedError));
  await approveScreen([{ level: "ok", reason: "x", evidence_url: "u" }], {});
  await approveScreen([{ level: "warn", reason: "x", evidence_url: "u" }], {}).then(() => assert(false, "warn without a browser must not pass"), (error) => assert(!(error instanceof ScreenBlockedError)));
  console.log("OK lists, levels");
};
console.log(`BLOCKED ${ofac[0].reason}`);
console.log("OK clean recipient address check");

if (process.env.SCREEN_TEST_CONTRACT) {
  const live = async () => {
    const actions: ConnectorAction[] = [{ type: "Transfer", params: { deposit: "1" } }];
    const sanctionedTx = await screenTransaction({ receiverId: sanctioned.address, actions }, "testnet", "screen-test", { contractFreshnessHours: 24 });
    assert(sanctionedTx.some((check) => check.level === "block"), JSON.stringify(sanctionedTx));
    console.log(`BLOCKED ${sanctionedTx.find((check) => check.level === "block")!.reason}`);
    const cleanTx = await screenTransaction({ receiverId: "wrap.testnet", actions }, "testnet", "screen-test", { contractFreshnessHours: 24 });
    assert(cleanTx.every((check) => check.level === "ok"), JSON.stringify(cleanTx));
    console.log("OK clean testnet transfer");
    const fresh = await screenTransaction({ receiverId: process.env.SCREEN_TEST_CONTRACT!, actions }, "testnet", "screen-test", { contractFreshnessHours: 24 });
    assert(fresh.some((check) => check.level === "warn" && check.reason.includes("contract code changed within the last 24 hours")), JSON.stringify(fresh));
    console.log("Fresh testnet contract warning passed");

    const live = await fetchPrices(["wrap.near", "usdt.tether-token.near"]);
    assert(live["wrap.near"]?.decimals === 24 && live["wrap.near"].price > 0 && live["usdt.tether-token.near"]?.decimals === 6, JSON.stringify(live));
    const swapWarning = (check: { reason: string }) => check.reason.startsWith("The swap accepts");
    const bad = await screenTransaction({ receiverId: "wrap.near", actions: swapCall(JSON.stringify(route)) }, "mainnet", "swap-test", {});
    assert(bad.some((check) => check.level === "warn" && swapWarning(check)), `a 1 NEAR swap with a 1 USDt minimum warns: ${JSON.stringify(bad)}`);
    const fairOut = Math.floor(0.97 * (live["wrap.near"].price / live["usdt.tether-token.near"].price) * 1e6).toString();
    const fair = await screenTransaction({ receiverId: "wrap.near", actions: swapCall(JSON.stringify({ actions: [{ ...route.actions[0], min_amount_out: fairOut }] })) }, "mainnet", "swap-test", {});
    assert(!fair.some(swapWarning), `a swap within 3% of market does not warn: ${JSON.stringify(fair)}`);
    console.log("Swap minimum-output warning passed");

    const sent = "0xa12345678901234567890123456789012345cdef";
    const lookalikeId = "0xa19876543210987654321098765432109876cdef";
    const send = async () => "sent";
    assert(await screenAndSend({}, [tx(sent)], "testnet", "wallet-a.testnet", send) === "sent");
    await screenAndSend({}, [tx(lookalikeId)], "testnet", "wallet-a.testnet", send).then(() => assert(false, "lookalike of an address this wallet sent to must be blocked"), (error) => assert(error instanceof ScreenBlockedError, String(error)));
    assert(await screenAndSend({}, [tx(lookalikeId)], "testnet", "wallet-b.testnet", send) === "sent", "history is per wallet: another account is not blocked");
    console.log("Poisoning block is scoped to the sending wallet");
  };
  main().then(live).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  main().then(() => console.log("OFAC block, clean pass, and poison block passed; SCREEN_TEST_CONTRACT is required for the live freshness assertion"));
}
