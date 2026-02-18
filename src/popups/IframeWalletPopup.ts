import { html } from "../helpers/html";
import { FooterBranding } from "../types";
import { Popup } from "./Popup";

export class IframeWalletPopup extends Popup<{}> {
  constructor(
    readonly delegate: {
      iframe: HTMLIFrameElement;
      footer: FooterBranding | null;
      onApprove: () => void;
      onReject: () => void;
    }
  ) {
    super(delegate);
  }

  handlers() {
    super.handlers();
    this.addListener("button", "click", () => this.delegate.onApprove());
  }

  create() {
    super.create({ show: false });
    const modalBody = this.root.querySelector(".modal-body")! as HTMLElement;
    modalBody.appendChild(this.delegate.iframe);
    this.delegate.iframe.style.width = "100%";
    this.delegate.iframe.style.height = "720px";
    this.delegate.iframe.style.border = "none";
  }

  get footer() {
    if (!this.delegate.footer) return "";
    const { icon, heading, link, linkText } = this.delegate.footer;

    return html`
      <div class="footer">
        <img src="${icon}" alt="${heading}" />
        <p>${heading}</p>
        <a class="get-wallet-link" href="${link}" target="_blank">${linkText}</a>
      </div>
    `;
  }

  get dom() {
    return html` <div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
        <div class="footer">
          <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="NEAR Connector" />
          <p>NEAR Connector</p>
          <p class="get-wallet-link">Don't have a wallet?</p>
        </div>
      </div>
    </div>`;
  }
}
