import { NearWalletBase } from "@hot-labs/near-connect";

export interface IPropsWalletAction {
  network: "testnet" | "mainnet";
  wallet: NearWalletBase;
  extendedSecretKey?: string;
}
