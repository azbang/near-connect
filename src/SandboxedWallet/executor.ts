import { WalletManifest, WalletPermissions } from "../types";
import { NearConnector } from "../NearConnector";
import { parseUrl } from "../helpers/url";
import { uuid4 } from "../helpers/uuid";

import IframeExecutor from "./iframe";

const cacheId = uuid4();

class SandboxExecutor {
  private activePanels: Record<string, Window> = {};
  readonly storageSpace: string;

  constructor(readonly connector: NearConnector, readonly manifest: WalletManifest) {
    this.storageSpace = manifest.id;
  }

  checkPermissions(action: keyof WalletPermissions, params?: { url?: string; entity?: string }) {
    if (action === "walletConnect") {
      return !!this.manifest.permissions.walletConnect;
    }

    if (action === "external") {
      const external = this.manifest.permissions.external;
      if (!external || !params?.entity) return false;
      return external.includes(params.entity);
    }

    if (action === "allowsOpen") {
      const openUrl = parseUrl(params?.url || "");
      const allowsOpen = this.manifest.permissions.allowsOpen;

      if (!openUrl || !allowsOpen || !Array.isArray(allowsOpen) || allowsOpen.length === 0) return false;
      const isAllowed = allowsOpen.some((path) => {
        const url = parseUrl(path);
        if (!url) return false;

        if (openUrl.protocol !== url.protocol) return false;
        if (!!url.hostname && openUrl.hostname !== url.hostname) return false;
        if (!!url.pathname && url.pathname !== "/" && openUrl.pathname !== url.pathname) return false;
        return true;
      });

      return isAllowed;
    }

    return this.manifest.permissions[action];
  }

  assertPermissions(iframe: IframeExecutor, action: keyof WalletPermissions, event: MessageEvent) {
    if (!this.checkPermissions(action, event.data.params)) {
      iframe.postMessage({ ...event.data, status: "failed", result: "Permission denied" });
      throw new Error("Permission denied");
    }
  }

  _onMessage = async (iframe: IframeExecutor, event: MessageEvent) => {
    const success = (result: any) => {
      iframe.postMessage({ ...event.data, status: "success", result: result });
    };

    const failed = (error: any) => {
      iframe.postMessage({ ...event.data, status: "failed", result: error });
    };

    if (event.data.method === "ui.showIframe") {
      iframe.show();
      success(null);
      return;
    }

    if (event.data.method === "ui.hideIframe") {
      iframe.hide();
      success(null);
      return;
    }

    if (event.data.method === "storage.set") {
      this.assertPermissions(iframe, "storage", event);
      localStorage.setItem(`${this.storageSpace}:${event.data.params.key}`, event.data.params.value);
      success(null);
      return;
    }

    if (event.data.method === "storage.get") {
      this.assertPermissions(iframe, "storage", event);
      const value = localStorage.getItem(`${this.storageSpace}:${event.data.params.key}`);
      success(value);
      return;
    }

    if (event.data.method === "storage.keys") {
      this.assertPermissions(iframe, "storage", event);
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(`${this.storageSpace}:`));
      success(keys);
      return;
    }

    if (event.data.method === "storage.remove") {
      this.assertPermissions(iframe, "storage", event);
      localStorage.removeItem(`${this.storageSpace}:${event.data.params.key}`);
      success(null);
      return;
    }

    if (event.data.method === "panel.focus") {
      const panel = this.activePanels[event.data.params.windowId];
      if (panel) panel.focus();
      success(null);
      return;
    }

    if (event.data.method === "panel.postMessage") {
      const panel = this.activePanels[event.data.params.windowId];
      if (panel) panel.postMessage(event.data.params.data, "*");
      success(null);
      return;
    }

    if (event.data.method === "panel.close") {
      const panel = this.activePanels[event.data.params.windowId];
      if (panel) panel.close();

      delete this.activePanels[event.data.params.windowId];
      success(null);
      return;
    }

    if (event.data.method === "walletConnect.connect") {
      this.assertPermissions(iframe, "walletConnect", event);
      try {
        if (!this.connector.walletConnect) throw new Error("WalletConnect is not configured");
        const client = await this.connector.walletConnect;
        const result = await client.connect(event.data.params);
        result.approval();
        success({ uri: result.uri });
      } catch (e) {
        failed(e);
      }
      return;
    }

    if (event.data.method === "walletConnect.getProjectId") {
      if (!this.connector.walletConnect) throw new Error("WalletConnect is not configured");
      this.assertPermissions(iframe, "walletConnect", event);
      const client = await this.connector.walletConnect;
      success(client.core.projectId);
      return;
    }

    if (event.data.method === "walletConnect.disconnect") {
      this.assertPermissions(iframe, "walletConnect", event);
      try {
        if (!this.connector.walletConnect) throw new Error("WalletConnect is not configured");
        const client = await this.connector.walletConnect;
        const result = await client.disconnect(event.data.params);
        success(result);
      } catch (e) {
        failed(e);
      }
      return;
    }

    if (event.data.method === "walletConnect.getSession") {
      this.assertPermissions(iframe, "walletConnect", event);
      try {
        if (!this.connector.walletConnect) throw new Error("WalletConnect is not configured");
        const client = await this.connector.walletConnect;
        const key = client.session.keys[client.session.keys.length - 1];
        const session = key ? client.session.get(key) : null;
        success(session ? { topic: session.topic, namespaces: session.namespaces } : null);
      } catch (e) {
        failed(e);
      }
      return;
    }

    if (event.data.method === "walletConnect.request") {
      this.assertPermissions(iframe, "walletConnect", event);
      try {
        if (!this.connector.walletConnect) throw new Error("WalletConnect is not configured");
        const client = await this.connector.walletConnect;
        const result = await client.request(event.data.params);
        success(result);
      } catch (e) {
        failed(e);
      }
      return;
    }

    if (event.data.method === "external") {
      this.assertPermissions(iframe, "external", event);
      try {
        const { entity, key, args } = event.data.params;
        const obj = entity.split(".").reduce((acc: any, key: string) => acc[key], window);

        // TODO: remove hack after Nightly fixes.
        // Their method wait near.Transaction and call encode() to get bytes.
        // External API should not require non-serializable data, this is unsafe from an isolation point of view.
        if (entity === "nightly.near" && key === "signTransaction") {
          args[0].encode = () => args[0];
        }

        const result = typeof obj[key] === "function" ? await obj[key](...(args || [])) : obj[key];
        success(result);
      } catch (e) {
        failed(e);
      }
      return;
    }

    if (event.data.method === "open") {
      this.assertPermissions(iframe, "allowsOpen", event);

      // Open in Telegram Mini App
      const tgapp = typeof window !== "undefined" ? (window as any)?.Telegram?.WebApp : null;
      if (tgapp && event.data.params.url.startsWith("https://t.me")) {
        tgapp.openTelegramLink(event.data.params.url);
        return;
      }

      const panel = window.open(event.data.params.url, "_blank", event.data.params.features);
      const panelId = panel ? uuid4() : null;

      const handler = (ev: MessageEvent) => {
        const url = parseUrl(event.data.params.url);
        if (url && url.origin === ev.origin) {
          iframe.postMessage(ev.data);
        }
      };

      success(panelId);
      window.addEventListener("message", handler);

      if (panel && panelId) {
        this.activePanels[panelId] = panel;
        const interval = setInterval(() => {
          if (!panel?.closed) return;

          window.removeEventListener("message", handler);
          const args = { method: "proxy-window:closed", windowId: panelId };
          delete this.activePanels[panelId];
          clearInterval(interval);

          try {
            iframe.postMessage(args);
          } catch {}
        }, 500);
      }

      return;
    }

    if (event.data.method === "open.nativeApp") {
      this.assertPermissions(iframe, "allowsOpen", event);

      const url = parseUrl(event.data.params.url);
      const invalid = ["https", "http", "javascript:", "file:", "data:", "blob:", "about:"];
      if (!url || invalid.includes(url.protocol)) {
        failed("Invalid URL");
        throw new Error("[open.nativeApp] Invalid URL");
      }

      const linkIframe = document.createElement("iframe");
      linkIframe.src = event.data.params.url;
      linkIframe.style.display = "none";
      document.body.appendChild(linkIframe);
      iframe.postMessage({ ...event.data, status: "success", result: null });
      return;
    }
  };

  private actualCode: string | null = null;
  async checkNewVersion(executor: SandboxExecutor, currentVersion: string | null) {
    if (this.actualCode) {
      this.connector.logger?.log(`New version of code already checked`);
      return this.actualCode;
    }

    let url = parseUrl(executor.manifest.executor);
    if (!url) url = parseUrl(location.origin + executor.manifest.executor); // relative url
    if (!url) throw new Error("Invalid executor URL");

    url.searchParams.set("nonce", cacheId);
    const newVersion = await fetch(url.toString()).then((res) => res.text());
    this.connector.logger?.log(`New version of code fetched`);
    this.actualCode = newVersion;

    if (newVersion === currentVersion) {
      this.connector.logger?.log(`New version of code is the same as the current version`);
      return this.actualCode;
    }

    await this.connector.db.setItem(`${this.manifest.id}:${this.manifest.version}`, newVersion);
    this.connector.logger?.log(`New version of code saved to cache`);
    return newVersion;
  }

  async loadCode(): Promise<string> {
    const cachedCode = await this.connector.db.getItem<string>(`${this.manifest.id}:${this.manifest.version}`).catch(() => null);
    this.connector.logger?.log(`Code loaded from cache`, cachedCode !== null);

    const task = this.checkNewVersion(this, cachedCode as string | null);
    if (cachedCode) return cachedCode;
    return await task;
  }

  async call<T>(method: string, params: any): Promise<T> {
    this.connector.logger?.log(`Add to queue`, method, params);

    // return this.queue.enqueue(async () => {
    this.connector.logger?.log(`Calling method`, method, params);

    const code = await this.loadCode();
    this.connector.logger?.log(`Code loaded, preparing`);

    const iframe = new IframeExecutor(this, code, this._onMessage);
    this.connector.logger?.log(`Code loaded, iframe initialized`);

    await iframe.readyPromise;
    this.connector.logger?.log(`Iframe ready`);

    const id = uuid4();
    return new Promise<T>((resolve, reject) => {
      try {
        const handler = (event: MessageEvent) => {
          if (event.data.id !== id || event.data.origin !== iframe.origin) return;

          iframe.dispose();
          window.removeEventListener("message", handler);
          this.connector.logger?.log("postMessage", { result: event.data, request: { method, params } });

          if (event.data.status === "failed") reject(event.data.result);
          else resolve(event.data.result);
        };

        window.addEventListener("message", handler);
        iframe.postMessage({ method, params, id });
        iframe.on("close", () => reject(new Error("Wallet closed")));
      } catch (e) {
        this.connector.logger?.log(`Iframe error`, e);
        reject(e);
      }
    });
    // });
  }

  async getAllStorage() {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(`${this.storageSpace}:`));
    const storage: Record<string, any> = {};

    for (const key of keys) {
      storage[key.replace(`${this.storageSpace}:`, "")] = localStorage.getItem(key);
    }

    return storage;
  }

  async clearStorage() {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(`${this.storageSpace}:`));
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }
}

export default SandboxExecutor;
