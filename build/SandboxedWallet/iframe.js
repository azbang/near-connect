"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("../helpers/events");
const uuid_1 = require("../helpers/uuid");
const IframeWalletPopup_1 = require("../popups/IframeWalletPopup");
const code_1 = __importDefault(require("./code"));
class IframeExecutor {
    executor;
    origin;
    iframe = document.createElement("iframe");
    events = new events_1.EventEmitter();
    popup;
    handler;
    readyPromiseResolve;
    readyPromise = new Promise((resolve) => {
        this.readyPromiseResolve = resolve;
    });
    constructor(executor, code, onMessage, cspNonce) {
        this.executor = executor;
        this.origin = (0, uuid_1.uuid4)();
        this.handler = (event) => {
            if (event.data.origin !== this.origin)
                return;
            if (event.data.method === "wallet-ready")
                this.readyPromiseResolve();
            onMessage(this, event);
        };
        window.addEventListener("message", this.handler);
        const iframeAllowedPermissions = [];
        if (this.executor.checkPermissions("usb"))
            iframeAllowedPermissions.push("usb *;");
        if (this.executor.checkPermissions("hid"))
            iframeAllowedPermissions.push("hid *;");
        if (this.executor.checkPermissions("clipboardRead"))
            iframeAllowedPermissions.push("clipboard-read;");
        if (this.executor.checkPermissions("clipboardWrite"))
            iframeAllowedPermissions.push("clipboard-write;");
        if (this.executor.checkPermissions("bluetooth"))
            iframeAllowedPermissions.push("bluetooth *;");
        if (this.executor.checkPermissions("webauthn")) {
            iframeAllowedPermissions.push("publickey-credentials-create *;");
            iframeAllowedPermissions.push("publickey-credentials-get *;");
        }
        this.iframe.allow = iframeAllowedPermissions.join(" ");
        this.iframe.setAttribute("sandbox", "allow-scripts");
        (0, code_1.default)({ id: this.origin, executor: this.executor, code, cspNonce }).then((code) => {
            this.executor.connector.logger?.log(`Iframe code injected`);
            this.iframe.srcdoc = code;
        });
        this.popup = new IframeWalletPopup_1.IframeWalletPopup({
            footer: this.executor.connector.footerBranding,
            iframe: this.iframe,
            onApprove: () => { },
            onReject: () => {
                window.removeEventListener("message", this.handler);
                this.events.emit("close", {});
                this.popup.destroy();
            },
        });
        this.popup.create();
    }
    on(event, callback) {
        this.events.on(event, callback);
    }
    show() {
        this.popup.show();
    }
    hide() {
        this.popup.hide();
    }
    postMessage(data) {
        if (!this.iframe.contentWindow)
            throw new Error("Iframe not loaded");
        this.iframe.contentWindow.postMessage({ ...data, origin: this.origin }, "*");
    }
    dispose() {
        window.removeEventListener("message", this.handler);
        this.popup.destroy();
    }
}
exports.default = IframeExecutor;
//# sourceMappingURL=iframe.js.map