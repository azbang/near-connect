"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("../helpers/url");
const uuid_1 = require("../helpers/uuid");
const iframe_1 = __importDefault(require("./iframe"));
const cacheId = (0, uuid_1.uuid4)();
// ─── Injected Ethereum provider discovery ────────────────────────────────────
// Used by the `ethereum.*` bridge so sandboxed wallets (e.g. eip712-wallet)
// can talk to browser-extension wallets without breaking iframe isolation —
// only JSON-RPC `request({method, params})` crosses the boundary.
//
// Two discovery channels:
//   1. Legacy: `window.ethereum` (single global).
//   2. EIP-6963: providers dispatch `eip6963:announceProvider` in response
//      to a page-emitted `eip6963:requestProvider`. Required for MetaMask
//      and any other provider that no longer injects the legacy global.
const _eip6963Providers = [];
let _eip6963ListenerInstalled = false;
// Index of the provider currently exposed via `pickEthereumProvider()`.
// Advanced by `ethereum.next` so the iframe's "Use a different wallet"
// button can rotate through detected providers.
let _eip6963ProviderIndex = 0;
// Set when the iframe explicitly opts out of the injected-provider bridge
// (user picked "Use a different wallet" with no more rotations, or the
// extension revoked permission). The bridge then reports unavailable and
// the iframe falls back to its WalletConnect path.
let _ethereumBridgeDisabled = false;
function installEip6963Listener() {
    if (typeof window === "undefined" || _eip6963ListenerInstalled)
        return;
    _eip6963ListenerInstalled = true;
    window.addEventListener("eip6963:announceProvider", (event) => {
        const provider = event?.detail?.provider;
        if (provider && !_eip6963Providers.includes(provider))
            _eip6963Providers.push(provider);
    });
    // Prompt any provider that's already loaded to re-announce. Per EIP-6963
    // the wallet listens for this and re-dispatches `eip6963:announceProvider`.
    window.dispatchEvent(new CustomEvent("eip6963:requestProvider"));
}
if (typeof window !== "undefined")
    installEip6963Listener();
function pickEthereumProvider() {
    // Prefer EIP-6963 (multi-provider safe). Fall back to the legacy global
    // `window.ethereum`, re-reading on each call so we don't cache a stale
    // null from a load order race.
    if (_eip6963Providers.length > 0) {
        return _eip6963Providers[_eip6963ProviderIndex % _eip6963Providers.length];
    }
    if (typeof window !== "undefined" && window.ethereum)
        return window.ethereum;
    return null;
}
async function waitForEthereumProvider(timeoutMs = 800) {
    installEip6963Listener();
    const existing = pickEthereumProvider();
    if (existing)
        return existing;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // Re-emit periodically — some providers attach the listener late.
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("eip6963:requestProvider"));
        }
        await new Promise((r) => setTimeout(r, 100));
        const found = pickEthereumProvider();
        if (found)
            return found;
    }
    return null;
}
class SandboxExecutor {
    connector;
    manifest;
    activePanels = {};
    storageSpace;
    constructor(connector, manifest) {
        this.connector = connector;
        this.manifest = manifest;
        this.storageSpace = manifest.id;
    }
    checkPermissions(action, params) {
        if (action === "walletConnect") {
            return !!this.manifest.permissions.walletConnect;
        }
        if (action === "external") {
            const external = this.manifest.permissions.external;
            if (!external || !params?.entity)
                return false;
            return external.includes(params.entity);
        }
        if (action === "allowsOpen") {
            const openUrl = (0, url_1.parseUrl)(params?.url || "");
            if (!openUrl)
                return false;
            // WalletConnect needs to deeplink into arbitrary wallet apps via
            // both custom schemes (`ledgerlive:`, `metamask:`, `rainbow:`, …)
            // and web entry points (`https://console.fireblocks.io/v2/wc?...`,
            // `https://link.metamask.io/...`, etc.). Enumerating every wallet
            // is unmaintainable, so a wallet granted the `walletConnect`
            // permission may open any URL except known-dangerous schemes.
            const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "blob:", "file:", "about:"]);
            if (DANGEROUS_SCHEMES.has(openUrl.protocol.toLowerCase()))
                return false;
            if (this.manifest.permissions.walletConnect === true)
                return true;
            const allowsOpen = this.manifest.permissions.allowsOpen;
            if (!allowsOpen || !Array.isArray(allowsOpen) || allowsOpen.length === 0)
                return false;
            const isAllowed = allowsOpen.some((path) => {
                // Protocol-only patterns like "wc:" or "metamask:" allow any URL
                // with that scheme. Needed for WalletConnect deeplinks: the spec
                // pairing URI is `wc:<topic>?...` which `new URL("wc:")` rejects,
                // so a plain `new URL(path)` comparison would never match.
                if (/^[a-z][a-z0-9+.-]*:$/i.test(path)) {
                    return openUrl.protocol.toLowerCase() === path.toLowerCase();
                }
                const url = (0, url_1.parseUrl)(path);
                if (!url)
                    return false;
                if (openUrl.protocol !== url.protocol)
                    return false;
                if (!!url.hostname && openUrl.hostname !== url.hostname)
                    return false;
                if (!!url.pathname && url.pathname !== "/" && openUrl.pathname !== url.pathname)
                    return false;
                return true;
            });
            return isAllowed;
        }
        return this.manifest.permissions[action];
    }
    assertPermissions(iframe, action, event) {
        if (!this.checkPermissions(action, event.data.params)) {
            iframe.postMessage({ ...event.data, status: "failed", result: "Permission denied" });
            throw new Error("Permission denied");
        }
    }
    _onMessage = async (iframe, event) => {
        const success = (result) => {
            iframe.postMessage({ ...event.data, status: "success", result: result });
        };
        const failed = (error) => {
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
            if (panel)
                panel.focus();
            success(null);
            return;
        }
        if (event.data.method === "panel.postMessage") {
            const panel = this.activePanels[event.data.params.windowId];
            if (panel)
                panel.postMessage(event.data.params.data, "*");
            success(null);
            return;
        }
        if (event.data.method === "panel.close") {
            const panel = this.activePanels[event.data.params.windowId];
            if (panel)
                panel.close();
            delete this.activePanels[event.data.params.windowId];
            success(null);
            return;
        }
        if (event.data.method === "walletConnect.connect") {
            this.assertPermissions(iframe, "walletConnect", event);
            try {
                if (!this.connector.walletConnect)
                    throw new Error("WalletConnect is not configured");
                const client = await this.connector.walletConnect;
                const result = await client.connect(event.data.params);
                result.approval();
                success({ uri: result.uri });
            }
            catch (e) {
                failed(e);
            }
            return;
        }
        if (event.data.method === "walletConnect.getProjectId") {
            if (!this.connector.walletConnect)
                throw new Error("WalletConnect is not configured");
            this.assertPermissions(iframe, "walletConnect", event);
            const client = await this.connector.walletConnect;
            success(client.core.projectId);
            return;
        }
        if (event.data.method === "walletConnect.disconnect") {
            this.assertPermissions(iframe, "walletConnect", event);
            try {
                if (!this.connector.walletConnect)
                    throw new Error("WalletConnect is not configured");
                const client = await this.connector.walletConnect;
                const result = await client.disconnect(event.data.params);
                success(result);
            }
            catch (e) {
                failed(e);
            }
            return;
        }
        if (event.data.method === "walletConnect.getSession") {
            this.assertPermissions(iframe, "walletConnect", event);
            try {
                if (!this.connector.walletConnect)
                    throw new Error("WalletConnect is not configured");
                const client = await this.connector.walletConnect;
                const key = client.session.keys[client.session.keys.length - 1];
                const session = key ? client.session.get(key) : null;
                success(session ? { topic: session.topic, namespaces: session.namespaces } : null);
            }
            catch (e) {
                failed(e);
            }
            return;
        }
        if (event.data.method === "walletConnect.request") {
            this.assertPermissions(iframe, "walletConnect", event);
            try {
                if (!this.connector.walletConnect)
                    throw new Error("WalletConnect is not configured");
                const client = await this.connector.walletConnect;
                const result = await client.request(event.data.params);
                success(result);
            }
            catch (e) {
                failed(e);
            }
            return;
        }
        if (event.data.method === "external") {
            this.assertPermissions(iframe, "external", event);
            try {
                const { entity, key, args } = event.data.params;
                const obj = entity.split(".").reduce((acc, key) => acc[key], window);
                // TODO: remove hack after Nightly fixes.
                // Their method wait near.Transaction and call encode() to get bytes.
                // External API should not require non-serializable data, this is unsafe from an isolation point of view.
                if (entity === "nightly.near" && key === "signTransaction") {
                    args[0].encode = () => args[0];
                }
                const result = typeof obj[key] === "function" ? await obj[key](...(args || [])) : obj[key];
                success(result);
            }
            catch (e) {
                failed(e);
            }
            return;
        }
        if (event.data.method === "open") {
            this.assertPermissions(iframe, "allowsOpen", event);
            // Open in Telegram Mini App
            const tgapp = typeof window !== "undefined" ? window?.Telegram?.WebApp : null;
            if (tgapp && event.data.params.url.startsWith("https://t.me")) {
                tgapp.openTelegramLink(event.data.params.url);
                return;
            }
            const panel = window.open(event.data.params.url, "_blank", event.data.params.features);
            const panelId = panel ? (0, uuid_1.uuid4)() : null;
            const handler = (ev) => {
                const url = (0, url_1.parseUrl)(event.data.params.url);
                if (url && url.origin === ev.origin) {
                    iframe.postMessage(ev.data);
                }
            };
            success(panelId);
            window.addEventListener("message", handler);
            if (panel && panelId) {
                this.activePanels[panelId] = panel;
                const interval = setInterval(() => {
                    if (!panel?.closed)
                        return;
                    window.removeEventListener("message", handler);
                    const args = { method: "proxy-window:closed", windowId: panelId };
                    delete this.activePanels[panelId];
                    clearInterval(interval);
                    try {
                        iframe.postMessage(args);
                    }
                    catch { }
                }, 500);
            }
            return;
        }
        if (event.data.method === "webauthn.create") {
            this.assertPermissions(iframe, "webauthn", event);
            try {
                const options = event.data.params;
                // Reconstruct ArrayBuffer fields from serialized arrays
                if (options.challenge)
                    options.challenge = new Uint8Array(options.challenge).buffer;
                if (options.user?.id)
                    options.user.id = new Uint8Array(options.user.id).buffer;
                if (options.excludeCredentials) {
                    options.excludeCredentials = options.excludeCredentials.map((c) => ({
                        ...c,
                        id: new Uint8Array(c.id).buffer,
                    }));
                }
                const credential = await navigator.credentials.create({ publicKey: options });
                if (!(credential instanceof PublicKeyCredential))
                    throw new Error("Invalid credential");
                const response = credential.response;
                const result = {
                    rawId: Array.from(new Uint8Array(credential.rawId)),
                    clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
                    attestationObject: Array.from(new Uint8Array(response.attestationObject)),
                };
                if (typeof response.getPublicKey === "function") {
                    const spki = response.getPublicKey();
                    result.publicKey = spki ? Array.from(new Uint8Array(spki)) : null;
                }
                success(result);
            }
            catch (e) {
                failed(e instanceof Error ? e.message : String(e));
            }
            return;
        }
        if (event.data.method === "webauthn.get") {
            this.assertPermissions(iframe, "webauthn", event);
            try {
                const options = event.data.params;
                if (options.challenge)
                    options.challenge = new Uint8Array(options.challenge).buffer;
                if (options.allowCredentials) {
                    options.allowCredentials = options.allowCredentials.map((c) => ({
                        ...c,
                        id: new Uint8Array(c.id).buffer,
                    }));
                }
                const credential = await navigator.credentials.get({ publicKey: options });
                if (!(credential instanceof PublicKeyCredential))
                    throw new Error("Invalid credential");
                const response = credential.response;
                success({
                    rawId: Array.from(new Uint8Array(credential.rawId)),
                    signature: Array.from(new Uint8Array(response.signature)),
                    authenticatorData: Array.from(new Uint8Array(response.authenticatorData)),
                    clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
                });
            }
            catch (e) {
                failed(e instanceof Error ? e.message : String(e));
            }
            return;
        }
        // Bridge to a browser-extension Ethereum provider (e.g. MetaMask). The
        // provider injects `window.ethereum` into the top-level page only — the
        // sandboxed iframe can't see it. Forwarding requests preserves the
        // iframe isolation: the executor never gets direct access to the
        // provider object, only the proxied JSON-RPC responses.
        if (event.data.method === "ethereum.isAvailable") {
            this.assertPermissions(iframe, "walletConnect", event);
            if (_ethereumBridgeDisabled) {
                success(false);
                return;
            }
            const eth = await waitForEthereumProvider();
            success(!!eth && typeof eth.request === "function");
            return;
        }
        // Rotate to the next detected EIP-6963 provider. Triggered by the
        // "Use a different wallet" button in sandboxed wallets so the user can
        // switch between multiple installed extensions without reloading.
        if (event.data.method === "ethereum.next") {
            this.assertPermissions(iframe, "walletConnect", event);
            if (_eip6963Providers.length > 1) {
                _eip6963ProviderIndex = (_eip6963ProviderIndex + 1) % _eip6963Providers.length;
            }
            success(_eip6963Providers.length > 1);
            return;
        }
        // Opt out of the injected-provider bridge entirely for the rest of the
        // session, so the iframe falls back to WalletConnect (e.g. user wants
        // Fireblocks instead of MetaMask, or revoked the extension's auth).
        if (event.data.method === "ethereum.disable") {
            this.assertPermissions(iframe, "walletConnect", event);
            _ethereumBridgeDisabled = true;
            success(null);
            return;
        }
        // Re-enable the bridge after a previous `disable`. Used when the user
        // wants to switch back from WalletConnect to the browser extension.
        if (event.data.method === "ethereum.enable") {
            this.assertPermissions(iframe, "walletConnect", event);
            _ethereumBridgeDisabled = false;
            success(null);
            return;
        }
        // Reports whether any extension provider was ever detected on the
        // page. Honest even when the bridge is currently disabled, so the
        // iframe can offer the "Use browser extension" affordance.
        if (event.data.method === "ethereum.detected") {
            this.assertPermissions(iframe, "walletConnect", event);
            const eth = await waitForEthereumProvider();
            success(!!eth && typeof eth.request === "function");
            return;
        }
        if (event.data.method === "ethereum.request") {
            this.assertPermissions(iframe, "walletConnect", event);
            const eth = await waitForEthereumProvider();
            if (!eth || typeof eth.request !== "function") {
                failed("No injected Ethereum provider available");
                return;
            }
            try {
                const result = await eth.request(event.data.params);
                success(result);
            }
            catch (e) {
                failed({ message: e?.message ?? String(e), code: e?.code });
            }
            return;
        }
        if (event.data.method === "open.nativeApp") {
            this.assertPermissions(iframe, "allowsOpen", event);
            const url = (0, url_1.parseUrl)(event.data.params.url);
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
    actualCode = null;
    async checkNewVersion(executor, currentVersion) {
        if (this.actualCode) {
            this.connector.logger?.log(`New version of code already checked`);
            return this.actualCode;
        }
        let url = (0, url_1.parseUrl)(executor.manifest.executor);
        if (!url)
            url = (0, url_1.parseUrl)(location.origin + executor.manifest.executor); // relative url
        if (!url)
            throw new Error("Invalid executor URL");
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
    async loadCode() {
        const cachedCode = await this.connector.db.getItem(`${this.manifest.id}:${this.manifest.version}`).catch(() => null);
        this.connector.logger?.log(`Code loaded from cache`, cachedCode !== null);
        const task = this.checkNewVersion(this, cachedCode);
        if (cachedCode)
            return cachedCode;
        return await task;
    }
    async call(method, params) {
        this.connector.logger?.log(`Add to queue`, method, params);
        // return this.queue.enqueue(async () => {
        this.connector.logger?.log(`Calling method`, method, params);
        const code = await this.loadCode();
        this.connector.logger?.log(`Code loaded, preparing`);
        const iframe = new iframe_1.default(this, code, this._onMessage, this.connector.cspNonce);
        this.connector.logger?.log(`Code loaded, iframe initialized`);
        await iframe.readyPromise;
        this.connector.logger?.log(`Iframe ready`);
        const id = (0, uuid_1.uuid4)();
        return new Promise((resolve, reject) => {
            try {
                const handler = (event) => {
                    if (event.data.id !== id || event.data.origin !== iframe.origin)
                        return;
                    iframe.dispose();
                    window.removeEventListener("message", handler);
                    this.connector.logger?.log("postMessage", { result: event.data, request: { method, params } });
                    if (event.data.status === "failed")
                        reject(event.data.result);
                    else
                        resolve(event.data.result);
                };
                window.addEventListener("message", handler);
                iframe.postMessage({ method, params, id });
                iframe.on("close", () => reject(new Error("Wallet closed")));
            }
            catch (e) {
                this.connector.logger?.log(`Iframe error`, e);
                reject(e);
            }
        });
        // });
    }
    async getAllStorage() {
        const keys = Object.keys(localStorage).filter((key) => key.startsWith(`${this.storageSpace}:`));
        const storage = {};
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
exports.default = SandboxExecutor;
//# sourceMappingURL=executor.js.map