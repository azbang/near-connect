import { EventEmitter } from "../helpers/events";
import { uuid4 } from "../helpers/uuid";
import { IframeWalletPopup } from "../popups/IframeWalletPopup";

import getIframeCode from "./code";
import SandboxExecutor from "./executor";

class IframeExecutor {
  readonly origin: string;

  private iframe = document.createElement("iframe");
  private events = new EventEmitter<{ close: {} }>();
  private popup: IframeWalletPopup;

  private handler: (event: MessageEvent<any>) => void;
  private readyPromiseResolve!: (value: void) => void;
  readonly readyPromise = new Promise<void>((resolve) => {
    this.readyPromiseResolve = resolve;
  });

  constructor(readonly executor: SandboxExecutor, code: string, onMessage: (iframe: IframeExecutor, event: MessageEvent) => void) {
    this.origin = uuid4();
    this.handler = (event: MessageEvent<any>) => {
      if (event.data.origin !== this.origin) return;
      if (event.data.method === "wallet-ready") this.readyPromiseResolve();
      onMessage(this, event);
    };

    window.addEventListener("message", this.handler);

    const iframeAllowedPersimissions = [];
    if (this.executor.checkPermissions("usb")) iframeAllowedPersimissions.push("usb *;");
    if (this.executor.checkPermissions("hid")) iframeAllowedPersimissions.push("hid *;");
    if (this.executor.checkPermissions("clipboardRead")) iframeAllowedPersimissions.push("clipboard-read;");
    if (this.executor.checkPermissions("clipboardWrite")) iframeAllowedPersimissions.push("clipboard-write;");
    if (this.executor.checkPermissions("bluetooth")) iframeAllowedPersimissions.push("bluetooth *;");
    this.iframe.allow = iframeAllowedPersimissions.join(" ");
    this.iframe.setAttribute("sandbox", "allow-scripts");

    getIframeCode({ id: this.origin, executor: this.executor, code }).then((code) => {
      this.executor.connector.logger?.log(`Iframe code injected`);
      this.iframe.srcdoc = code;
    });

    this.popup = new IframeWalletPopup({
      footer: this.executor.connector.footerBranding,
      iframe: this.iframe,
      onApprove: () => {},
      onReject: () => {
        window.removeEventListener("message", this.handler);
        this.events.emit("close", {});
        this.popup.destroy();
      },
    });

    this.popup.create();
  }

  on(event: "close", callback: () => void) {
    this.events.on(event, callback);
  }

  show() {
    this.popup.show();
  }

  hide() {
    this.popup.hide();
  }

  postMessage(data: any) {
    if (!this.iframe.contentWindow) throw new Error("Iframe not loaded");
    this.iframe.contentWindow.postMessage({ ...data, origin: this.origin }, "*");
  }

  dispose() {
    window.removeEventListener("message", this.handler);
    this.popup.destroy();
  }
}

export default IframeExecutor;
