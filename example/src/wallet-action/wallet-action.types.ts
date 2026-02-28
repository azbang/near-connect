import { NearWalletBase } from "@fastnear/near-connect";

export interface IPropsWalletAction {
  network: "testnet" | "mainnet";
  wallet: NearWalletBase;
}
