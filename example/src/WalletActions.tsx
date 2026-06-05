import { SignMessage } from "./wallet-action/SignMessage.tsx";
import { SendTx } from "./wallet-action/SendTx.tsx";
import { ResolveAuth } from "./wallet-action/ResolveAuth.tsx";
import { smallGreyText } from "./ui/tailwind-vars.ts";
import { IPropsWalletAction } from "./wallet-action/wallet-action.types.ts";

export const WalletActions = (actionProps: IPropsWalletAction) => {
  return (
    <div className={"flex flex-col align-stretch gap-4"}>
      <p className={smallGreyText}>Wallet Actions</p>
      <div className={"flex flex-col flex-justify-stretch gap-4"}>
        <SignMessage {...actionProps} />
        <ResolveAuth {...actionProps} />
        <SendTx {...actionProps} />
      </div>
    </div>
  );
};
