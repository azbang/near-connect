import { AppKit } from "@reown/appkit";
import { Provider as SolanaProvider } from "@reown/appkit-utils/solana";
import SolanaAccount from "./wallet";
import { WalletType } from "../OmniWallet";
import { OmniConnector } from "../OmniConnector";

class SolanaConnector extends OmniConnector<SolanaAccount> {
  appKit: AppKit;

  type = WalletType.SOLANA;
  name = "Solana Wallet";
  icon = "https://storage.herewallet.app/ft/1001:native.png";
  id = "solana-reown";
  isSupported = true;

  constructor(appKit: AppKit) {
    super();

    this.appKit = appKit;
    this.appKit.subscribeProviders(async (state) => {
      const solanaProvider = state["solana"] as SolanaProvider;
      if (solanaProvider) this.setWallet(new SolanaAccount(this, solanaProvider));
      else this.removeWallet();
    });
  }

  async connect() {
    this.appKit.open({ namespace: "solana" });
  }

  async silentDisconnect() {
    this.appKit.disconnect("solana");
  }
}

export default SolanaConnector;
