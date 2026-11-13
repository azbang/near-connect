import fallback from "../src/screen/sanctioned-addresses-2026-11-09.json";
import { screenAddressChecks, screenTransaction } from "../src/screen";
import type { ConnectorAction } from "../src/actions/types";

declare const process: { env: Record<string, string | undefined>; exitCode?: number };
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
console.log(`BLOCKED ${ofac[0].reason}`);
console.log("OK clean recipient address check");

if (process.env.SCREEN_TEST_CONTRACT) {
  const main = async () => {
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
  };
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.log("OFAC block, clean pass, and poison block passed; SCREEN_TEST_CONTRACT is required for the live freshness assertion");
}
