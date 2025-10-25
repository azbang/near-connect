import { EventEmitter } from "./helpers/events";
import { NearWalletsPopup } from "./popups/NearWalletsPopup";
import { LocalStorage, DataStorage } from "./helpers/storage";
import IndexedDB from "./helpers/indexdb";

import { EventNearWalletInjected, WalletManifest, Network, WalletFeatures, Logger, NearWalletBase, Account } from "./types/wallet";
import { ParentFrameWallet } from "./ParentFrameWallet";
import { InjectedWallet } from "./InjectedWallet";
import { SandboxWallet } from "./SandboxedWallet";
import { EventMap } from "./types/wallet-events";
import { Action } from "./types/transactions";

interface NearConnectorOptions {
  isBannedNearAddress?: (address: string) => Promise<boolean>;

  providers?: { mainnet?: string[]; testnet?: string[] };
  features?: Partial<WalletFeatures>;
  excludedWallets?: string[];
  autoConnect?: boolean;
  network?: Network;

  manifest?: string | { wallets: WalletManifest[]; version: string };
  walletConnect?: { projectId: string; metadata: any };

  events?: EventEmitter<EventMap>;
  storage?: DataStorage;
  logger?: Logger;
}

const defaultManifests = [
  "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json",
  "https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json",
];

export class NearConnector {
  private storage: DataStorage;
  readonly events: EventEmitter<EventMap>;
  readonly db: IndexedDB;
  logger?: Logger;

  wallets: NearWalletBase[] = [];
  manifest: { wallets: WalletManifest[]; version: string } = { wallets: [], version: "1.0.0" };
  features: Partial<WalletFeatures> = {};
  network: Network = "mainnet";

  providers: { mainnet?: string[]; testnet?: string[] } = { mainnet: [], testnet: [] };
  walletConnect?: { projectId: string; metadata: any };

  excludedWallets: string[] = [];
  autoConnect?: boolean;

  isBannedNearAddress?: (address: string) => Promise<boolean>;

  readonly whenManifestLoaded: Promise<void>;

  constructor(options?: NearConnectorOptions) {
    this.db = new IndexedDB("hot-connector", "wallets");
    this.storage = options?.storage ?? new LocalStorage();
    this.events = options?.events ?? new EventEmitter<EventMap>();
    this.logger = options?.logger;

    this.network = options?.network ?? "mainnet";
    this.walletConnect = options?.walletConnect;
    this.isBannedNearAddress = options?.isBannedNearAddress;

    this.autoConnect = options?.autoConnect ?? true;
    this.providers = options?.providers ?? { mainnet: [], testnet: [] };

    this.excludedWallets = options?.excludedWallets ?? [];
    this.features = options?.features ?? {};

    this.whenManifestLoaded = new Promise(async (resolve) => {
      if (options?.manifest == null || typeof options.manifest === "string") {
        this.manifest = await this._loadManifest(options?.manifest).catch(() => ({ wallets: [], version: "1.0.0" }));
      } else {
        this.manifest = options?.manifest ?? { wallets: [], version: "1.0.0" };
      }

      const set = new Set(this.excludedWallets);
      set.delete("hot-wallet"); // always include hot-wallet

      this.manifest.wallets = this.manifest.wallets.filter((wallet) => {
        // Remove wallet with walletConnect permission but no projectId is provided
        if (wallet.permissions.walletConnect && !this.walletConnect) return false;
        if (set.has(wallet.id)) return false; // excluded wallets
        return true;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      resolve();
    });

    if (typeof window !== "undefined") {
      window.addEventListener<any>("near-wallet-injected", this._handleNearWalletInjected);
      window.dispatchEvent(new Event("near-selector-ready"));
      window.addEventListener("message", async (event) => {
        if (event.data.type === "near-wallet-injected") {
          await this.whenManifestLoaded.catch(() => {});
          this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== event.data.manifest.id);
          this.wallets.unshift(new ParentFrameWallet(this, event.data.manifest));
          this.events.emit("selector:walletsChanged", {});
          if (this.autoConnect) this.connect(event.data.manifest.id);
        }
      });
    }

    this.whenManifestLoaded.then(() => {
      if (typeof window !== "undefined") {
        window.parent.postMessage({ type: "near-selector-ready" }, "*");
      }

      this.manifest.wallets.forEach((wallet) => this.registerWallet(wallet));
      this.storage.get("debug-wallets").then((json) => {
        const debugWallets = JSON.parse(json ?? "[]") as WalletManifest[];
        debugWallets.forEach((wallet) => this.registerDebugWallet(wallet));
      });
    });
  }

  _client: import("@walletconnect/sign-client").default | null = null;
  async getWalletConnect() {
    const WalletConnect = await import("@walletconnect/sign-client");
    if (this._client) return this._client;

    this._client = await WalletConnect.default.init({
      projectId: this.walletConnect?.projectId,
      metadata: this.walletConnect?.metadata,
      relayUrl: "wss://relay.walletconnect.com",
    });

    return this._client;
  }

  get availableWallets() {
    const wallets = this.wallets.filter((wallet) => {
      return Object.entries(this.features).every(([key, value]) => {
        if (value && !wallet.manifest.features?.[key as keyof WalletFeatures]) return false;
        return true;
      });
    });

    return wallets.filter((wallet) => {
      if (this.network === "testnet" && !wallet.manifest.features?.testnet) return false;
      return true;
    });
  }

  private _handleNearWalletInjected = (event: EventNearWalletInjected) => {
    this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== event.detail.manifest.id);
    this.wallets.unshift(new InjectedWallet(this, event.detail as any));
    this.events.emit("selector:walletsChanged", {});
  };

  private async _loadManifest(manifestUrl?: string) {
    const manifestEndpoints = manifestUrl ? [manifestUrl] : defaultManifests;
    for (const endpoint of manifestEndpoints) {
      const res = await fetch(endpoint).catch(() => null);
      if (!res || !res.ok) continue;
      return await res.json(); // TODO: Validate this
    }

    throw new Error("Failed to load manifest");
  }

  async disconnectIfBanned(wallet: NearWalletBase, accounts: Account[]) {
    if (!this.isBannedNearAddress) return;
    for (const account of accounts) {
      const isBanned = await this.isBannedNearAddress(account.accountId);
      if (isBanned) {
        await this.disconnect(wallet);
        throw new Error("Banned near address");
      }
    }
  }

  async validateBannedNearAddressInTx(tx: { receiverId: string; actions: Action[] }) {
    if (!this.isBannedNearAddress) return;

    const isBanned = await this.isBannedNearAddress(tx.receiverId);
    if (isBanned) throw new Error("Banned receiver address");

    for (const action of tx.actions) {
      if (action.type === "FunctionCall") {
        const receiverId = action.params.args["receiver_id"];
        if (typeof receiverId !== "string") continue;
        const isBanned = await this.isBannedNearAddress(receiverId);
        if (isBanned) throw new Error("Banned receiver address");
      }
    }
  }

  async switchNetwork(network: "mainnet" | "testnet") {
    await this.disconnect().catch(() => {});
    this.network = network;
    await this.connect();
  }

  async registerWallet(manifest: WalletManifest) {
    if (manifest.type !== "sandbox") throw new Error("Only sandbox wallets are supported");
    if (this.wallets.find((wallet) => wallet.manifest.id === manifest.id)) return;
    this.wallets.push(new SandboxWallet(this, manifest));
    this.events.emit("selector:walletsChanged", {});
  }

  async registerDebugWallet(json: string | WalletManifest) {
    const manifest = typeof json === "string" ? (JSON.parse(json) as WalletManifest) : json;
    if (manifest.type !== "sandbox") throw new Error("Only sandbox wallets type are supported");
    if (!manifest.id) throw new Error("Manifest must have an id");
    if (!manifest.name) throw new Error("Manifest must have a name");
    if (!manifest.icon) throw new Error("Manifest must have an icon");
    if (!manifest.website) throw new Error("Manifest must have a website");
    if (!manifest.version) throw new Error("Manifest must have a version");
    if (!manifest.executor) throw new Error("Manifest must have an executor");
    if (!manifest.features) throw new Error("Manifest must have features");
    if (!manifest.permissions) throw new Error("Manifest must have permissions");
    if (this.wallets.find((wallet) => wallet.manifest.id === manifest.id)) throw new Error("Wallet already registered");

    manifest.debug = true;
    this.wallets.unshift(new SandboxWallet(this, manifest));
    this.events.emit("selector:walletsChanged", {});

    const debugWallets = this.wallets.filter((wallet) => wallet.manifest.debug).map((wallet) => wallet.manifest);
    this.storage.set("debug-wallets", JSON.stringify(debugWallets));
    return manifest;
  }

  async removeDebugWallet(id: string) {
    this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== id);
    const debugWallets = this.wallets.filter((wallet) => wallet.manifest.debug).map((wallet) => wallet.manifest);
    this.storage.set("debug-wallets", JSON.stringify(debugWallets));
    this.events.emit("selector:walletsChanged", {});
  }

  async selectWallet() {
    await this.whenManifestLoaded.catch(() => {});
    return new Promise<string>((resolve, reject) => {
      const popup = new NearWalletsPopup({
        wallets: this.availableWallets.map((wallet) => wallet.manifest),
        onRemoveDebugManifest: async (id: string) => this.removeDebugWallet(id),
        onAddDebugManifest: async (wallet: string) => this.registerDebugWallet(wallet),
        onReject: () => (reject(new Error("User rejected")), popup.destroy()),
        onSelect: (id: string) => (resolve(id), popup.destroy()),
      });

      popup.create();
    });
  }

  async connect(id?: string) {
    await this.whenManifestLoaded.catch(() => {});
    if (!id) id = await this.selectWallet();

    try {
      const wallet = await this.wallet(id);
      this.logger?.log(`Wallet available to connect`, wallet);

      await this.storage.set("selected-wallet", id);
      this.logger?.log(`Set preferred wallet, try to signIn`, id);

      const accounts = await wallet.signIn();
      if (!accounts?.length) throw new Error("Failed to sign in");

      await this.disconnectIfBanned(wallet, accounts);

      this.logger?.log(`Signed in to wallet`, id, accounts);
      this.events.emit("wallet:signIn", { wallet, accounts, success: true });
      return wallet;
    } catch (e) {
      this.logger?.log("Failed to connect to wallet", e);
      throw e;
    }
  }

  async disconnect(wallet?: NearWalletBase) {
    if (!wallet) wallet = await this.wallet();
    await wallet.signOut({ network: this.network });

    await this.storage.remove("selected-wallet");
    this.events.emit("wallet:signOut", { success: true });
  }

  async getConnectedWallet() {
    await this.whenManifestLoaded.catch(() => {});
    const id = await this.storage.get("selected-wallet");
    const wallet = this.wallets.find((wallet) => wallet.manifest.id === id);
    if (!wallet) throw new Error("No wallet selected");

    const accounts = await wallet.getAccounts();
    if (!accounts?.length) throw new Error("No accounts found");

    await this.disconnectIfBanned(wallet, accounts);

    return { wallet, accounts };
  }

  async wallet(id?: string | null): Promise<NearWalletBase> {
    await this.whenManifestLoaded.catch(() => {});

    if (!id) {
      return this.getConnectedWallet()
        .then(({ wallet }) => wallet)
        .catch(async () => {
          await this.storage.remove("selected-wallet");
          throw new Error("No accounts found");
        });
    }

    const wallet = this.wallets.find((wallet) => wallet.manifest.id === id);
    if (!wallet) throw new Error("Wallet not found");
    return wallet;
  }

  on<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
    this.events.on(event, callback);
  }

  once<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
    this.events.once(event, callback);
  }

  off<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void {
    this.events.off(event, callback);
  }

  removeAllListeners<K extends keyof EventMap>(event?: K): void {
    this.events.removeAllListeners(event);
  }
}
