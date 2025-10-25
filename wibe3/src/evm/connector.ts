import { AppKit } from "@reown/appkit";
import { Provider as EvmProvider } from "@reown/appkit-utils/ethers";
import { OmniConnector } from "../OmniConnector";
import { WalletType } from "../OmniWallet";
import EvmAccount from "./wallet";

class EvmConnector extends OmniConnector<EvmAccount> {
  appKit: AppKit;

  name = "EVM Wallet";
  icon = "https://storage.herewallet.app/ft/1:native.png";
  type = WalletType.EVM;
  isSupported = true;
  id = "evm-reown";

  constructor(appKit: AppKit) {
    super();

    this.appKit = appKit;
    this.appKit.subscribeProviders(async (state) => {
      const evmProvider = state["eip155"] as EvmProvider;
      if (evmProvider) this.setWallet(new EvmAccount(this, evmProvider));
      else this.removeWallet();
    });
  }

  async connect() {
    this.appKit.open({ namespace: "eip155" });
  }

  async silentDisconnect() {
    this.appKit.disconnect("eip155");
  }
}

export default EvmConnector;
