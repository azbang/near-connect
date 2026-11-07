import { WalletConnectModal } from "@walletconnect/modal";
import { NearRpc } from "./utils/rpc";
import { createOathWallet } from "./oath/connector";
import { pairOath } from "./oath/pairing";

const selector = window.selector;
const wallet = createOathWallet({
  bridge: selector.walletConnect,
  storage: selector.storage,
  rpc: network => new NearRpc(selector.providers?.[network]?.length ? selector.providers[network] :
    [network === "testnet" ? "https://rpc.testnet.near.org" : "https://rpc.mainnet.near.org"]),
  pair: async network => {
    selector.ui.showIframe();
    const modal = new WalletConnectModal({
      projectId: await selector.walletConnect.getProjectId(),
      chains: [`near:${network}`],
      explorerExcludedWalletIds: "ALL",
      enableExplorer: false,
      mobileWallets: [{ id: "oath-wallet", name: "Oath Wallet", links: { native: "oathwallet://", universal: "https://oathwallet.org" } }],
    });
    // The built-in QR modal and mobile handoff retain NEAR Connect's UI pattern.
    return pairOath(selector.walletConnect, {
      open: uri => modal.openModal({ uri, standaloneChains: [`near:${network}`] }),
      onClose: callback => modal.subscribeModal(({ open }) => { if (!open) callback(); }),
      close: () => modal.closeModal(),
    }, network);
  },
});
// Remote manifests can be newer than the host SDK. Never fall back to the
// older bridge's unscoped "last session" lookup for this wallet.
const unavailable = async () => { throw new Error("Please update NEAR Connect to a version with WalletConnect session filters to use Oath Wallet"); };
selector.ready(selector.walletConnect.supportsSessionFilters ? wallet : {
  getAccounts: async () => [], signIn: unavailable, signOut: async () => {},
  signAndSendTransaction: unavailable, signAndSendTransactions: unavailable,
});
