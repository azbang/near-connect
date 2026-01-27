import { html } from "../helpers/html";
import { Popup } from "./Popup";

export class IframeWalletPopup extends Popup<{}> {
  constructor(readonly delegate: { iframe: HTMLIFrameElement; onApprove: () => void; onReject: () => void }) {
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

  get dom() {
    return html` <div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
      </div>
    </div>`;
  }
}
