import { NearWalletBase } from "../types";

export type WalletPlugin = Partial<{
  [K in keyof NearWalletBase]: NearWalletBase[K] extends (...args: infer Args) => infer Return
    ? (...args: [...Args, () => Return]) => Return
    : never;
}> & {
  [key: string]: (...args: any[]) => any;
};
