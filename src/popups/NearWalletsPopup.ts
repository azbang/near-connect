import { html } from "../helpers/html";
import { parseUrl } from "../helpers/url";
import { WalletManifest } from "../types";
import { Popup } from "./Popup";

const debugManifest = {
  id: "custom-wallet",
  name: "Custom Wallet",
  icon: "https://www.mynearwallet.com/images/webclip.png",
  description: "Custom wallet for NEAR.",
  website: "",
  version: "1.0.0",
  executor: "your-executor-url.js",
  type: "sandbox",
  platform: {},
  features: {
    signMessage: true,
    signInWithoutAddKey: true,
    signAndSendTransaction: true,
    signAndSendTransactions: true,
  },
  permissions: {
    storage: true,
    allowsOpen: [],
  },
};

export class NearWalletsPopup extends Popup<{ wallets: WalletManifest[]; showSettings: boolean }> {
  constructor(
    readonly delegate: {
      wallets: WalletManifest[];
      onAddDebugManifest: (wallet: string) => Promise<WalletManifest>;
      onRemoveDebugManifest: (id: string) => Promise<void>;
      onSelect: (id: string) => void;
      onReject: () => void;
    }
  ) {
    super(delegate);
    this.update({ wallets: delegate.wallets, showSettings: false });
  }

  handlers() {
    super.handlers();

    this.addListener(".settings-button", "click", () => this.update({ showSettings: true }));
    this.addListener(".back-button", "click", () => this.update({ showSettings: false }));

    this.root.querySelectorAll(".connect-item").forEach((item) => {
      if (!(item instanceof HTMLDivElement)) return;
      this.addListener(item, "click", () => this.delegate.onSelect(item.dataset.type!));
    });

    this.root.querySelectorAll(".remove-wallet-button").forEach((item) => {
      if (!(item instanceof SVGSVGElement)) return;
      this.addListener(item, "click", async (e) => {
        e.stopPropagation();
        await this.delegate.onRemoveDebugManifest(item.dataset.type!);
        const wallets = this.state.wallets.filter((wallet: WalletManifest) => wallet.id !== item.dataset.type);
        this.update({ wallets });
      });
    });

    this.addListener(".add-debug-manifest-button", "click", async () => {
      try {
        const wallet = (this.root.querySelector("#debug-manifest-input") as HTMLTextAreaElement)?.value ?? "";
        const manifest = await this.delegate.onAddDebugManifest(wallet);
        this.update({ showSettings: false, wallets: [manifest, ...this.state.wallets] });
      } catch (error) {
        alert(`Something went wrong: ${error}`);
      }
    });
  }

  create() {
    super.create({ show: true });
  }

  walletDom(wallet: WalletManifest) {
    const removeButton = html`
      <svg
        class="remove-wallet-button"
        data-type="${wallet.id}"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style="margin-right: 4px;"
      >
        <path d="M18 6L6 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 6L18 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;

    return html`
      <div class="connect-item" data-type="${wallet.id}">
        <img style="background: #333" src="${wallet.icon}" alt="${wallet.name}" />
        <div class="connect-item-info">
          <span>${wallet.name}</span>
          <span class="wallet-address">${parseUrl(wallet.website)?.hostname}</span>
        </div>
        ${wallet.debug ? removeButton : ""}
      </div>
    `;
  }

  get dom() {
    if (this.state.showSettings) {
      return html`
        <div class="modal-container">
          <div class="modal-content">
            <div class="modal-header">
              <button class="back-button" style="left: 16px; right: unset;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <p>Settings</p>
            </div>

            <div class="modal-body">
              <p style="text-align: left;">
                You can add your wallet to dapp for debug,
                <a href="https://github.com/azbang/hot-connector" target="_blank">read the documentation.</a> Paste your manifest and click "Add".
              </p>

              <textarea style="width: 100%;" id="debug-manifest-input" rows="10">${JSON.stringify(debugManifest, null, 2)}</textarea>
              <button class="add-debug-manifest-button">Add</button>
            </div>

            <div class="footer">
              <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Connector" />
              <p>HOT Connector</p>
              <p class="get-wallet-link">Don't have a wallet?</p>
            </div>
          </div>
        </div>
      `;
    }

    return html`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <p>Select wallet</p>
          <button class="settings-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="19" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="5" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
          </button>
        </div>

        <div class="modal-body">${this.state.wallets.map((wallet: WalletManifest) => this.walletDom(wallet))}</div>

        <div class="footer">
          <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Connector" />
          <p>HOT Connector</p>
          <p class="get-wallet-link">Don't have a wallet?</p>
        </div>
      </div>
    </div>`;
  }
}
