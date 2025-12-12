import { IPropsWalletAction } from "./wallet-action.types.ts";

export const SignMessage = ({ wallet }: IPropsWalletAction) => {
  const signMessage = async () => {
    try {
      const nonce = new Uint8Array(window.crypto.getRandomValues(new Uint8Array(32)));
      const result = await wallet.signMessage?.({ message: "Hello", recipient: "Demo app", nonce });
      console.log(`Is verfiied: ${result?.signature}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={"input-form"}>
      <div className={"input-row no-grid"}>
        <button className={"input-button"} onClick={() => signMessage()}>
          Sign message
        </button>
      </div>
    </div>
  );
};
