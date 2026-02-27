import { NearWalletBase } from "@hot-labs/near-connect";
import type { NearPrefixedKey } from "../../../src/types";

export interface IPropsWalletAction {
  network: "testnet" | "mainnet";
  wallet: NearWalletBase;
  publicKey?: NearPrefixedKey;
}
