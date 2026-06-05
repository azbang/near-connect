"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IframeWalletPopup = void 0;
const html_1 = require("../helpers/html");
const Popup_1 = require("./Popup");
class IframeWalletPopup extends Popup_1.Popup {
    delegate;
    constructor(delegate) {
        super(delegate);
        this.delegate = delegate;
    }
    handlers() {
        super.handlers();
        this.addListener("button", "click", () => this.delegate.onApprove());
    }
    create() {
        super.create({ show: false });
        const modalBody = this.root.querySelector(".modal-body");
        modalBody.appendChild(this.delegate.iframe);
        this.delegate.iframe.style.width = "100%";
        this.delegate.iframe.style.height = "720px";
        this.delegate.iframe.style.border = "none";
    }
    get footer() {
        if (!this.delegate.footer)
            return "";
        const { icon, heading } = this.delegate.footer;
        return (0, html_1.html) `
      <div class="footer">
        ${icon ? (0, html_1.html) `<img src="${icon}" alt="${heading}" />` : ""}
        <p>${heading}</p>
      </div>
    `;
    }
    get dom() {
        return (0, html_1.html) `<div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
        ${this.footer}
      </div>
    </div>`;
    }
}
exports.IframeWalletPopup = IframeWalletPopup;
//# sourceMappingURL=IframeWalletPopup.js.map