import { EventEmitter } from "./helpers/events";
import { NearWalletsPopup } from "./popups/NearWalletsPopup";
import { LocalStorage, DataStorage } from "./helpers/storage";
import IndexedDB from "./helpers/indexdb";

import type {
  EventMap,
  EventNearWalletInjected,
  WalletManifest,
  Network,
  WalletFeatures,
  Logger,
  NearWalletBase,
  AbstractWalletConnect,
  FooterBranding,
  NearConnector_ConnectOptions,
  AddFunctionCallKeyParams,
} from "./types";
import type { WalletPlugin } from "./types/plugin";

import { ParentFrameWallet } from "./ParentFrameWallet";
import { InjectedWallet } from "./InjectedWallet";
import { SandboxWallet } from "./SandboxedWallet";

export interface NearConnectorOptions {
  providers?: { mainnet?: string[]; testnet?: string[] };
  features?: Partial<WalletFeatures>;
  excludedWallets?: string[];
  autoConnect?: boolean;
  network?: Network;

  manifest?: string | { wallets: WalletManifest[]; version: string };
  walletConnect?: Promise<AbstractWalletConnect> | AbstractWalletConnect;

  events?: EventEmitter<EventMap>;
  storage?: DataStorage;
  logger?: Logger;
  cspNonce?: string;

  /**
   * Footer branding for the wallet selector popup. If not provided, default branding will be used. If provided null, footer will be hidden.
   */
  footerBranding?: FooterBranding | null;

  /**
   * @deprecated
   * Some wallets allow adding a limited-access key to a contract as soon as the user connects their wallet.
   * This enables the app to sign non-payable transactions without requiring wallet approval each time.
   * However, this approach requires the user to submit an on-chain transaction during the initial connection, which may negatively affect the user experience.
   * A better practice is to add the limited-access key after the user has already begun actively interacting with your application.
   */
  signIn?: { contractId?: string; methodNames?: Array<string> };
}

const defaultManifests = [
  "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json",
  "https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json",
];

function createFilterForWalletFeatures(features: Partial<WalletFeatures>) {
  return (wallet: NearWalletBase) => {
    if (Object.entries(features).length === 0) return true;

    return Object.entries(features)
      .filter(([_, value]) => value === true)
      .every(([key]) => {
        return wallet.manifest.features?.[key as keyof WalletFeatures] === true;
      });
  };
}

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
  walletConnect?: Promise<AbstractWalletConnect> | AbstractWalletConnect;

  footerBranding: FooterBranding | null;
  excludedWallets: string[] = [];
  autoConnect?: boolean;
  cspNonce?: string;

  readonly whenManifestLoaded: Promise<void>;

  constructor(options?: NearConnectorOptions) {
    this.db = new IndexedDB("hot-connector", "wallets");
    this.storage = options?.storage ?? new LocalStorage();
    this.events = options?.events ?? new EventEmitter<EventMap>();
    this.logger = options?.logger;
    this.cspNonce = options?.cspNonce;

    this.network = options?.network ?? "mainnet";
    this.walletConnect = options?.walletConnect;

    this.autoConnect = options?.autoConnect ?? true;
    this.providers = options?.providers ?? { mainnet: [], testnet: [] };

    this.excludedWallets = options?.excludedWallets ?? [];

    this.features = options?.features ?? {};

    if (options?.footerBranding !== undefined) {
      this.footerBranding = options?.footerBranding;
    } else {
      this.footerBranding = {
        icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%20512%20512%22%20class%3D%22size-7%22%3E%3Crect%20width%3D%22512%22%20height%3D%22512%22%20fill%3D%22%2300ec97%22%20rx%3D%22110%22%2F%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M373.89%20106.199a31.95%2031.95%200%200%200-27.213%2015.207l-62.631%2092.979a6.67%206.67%200%200%200-.989%205.001%206.66%206.66%200%200%200%202.837%204.235%206.67%206.67%200%200%200%208.032-.494l61.643-53.47c1.02-.924%202.599-.827%203.523.193.419.473.644%201.074.644%201.697v167.402a2.49%202.49%200%200%201-2.502%202.491%202.48%202.48%200%200%201-1.912-.891L168.976%20117.497a31.93%2031.93%200%200%200-24.356-11.298h-6.508c-17.623%200-31.917%2014.294-31.917%2031.917v235.767c0%2017.623%2014.294%2031.917%2031.917%2031.917a31.94%2031.94%200%200%200%2027.213-15.206l62.631-92.98a6.66%206.66%200%200%200-1.847-9.236%206.67%206.67%200%200%200-8.033.494l-61.643%2053.471c-1.02.923-2.599.826-3.522-.194a2.5%202.5%200%200%201-.634-1.697V173.008a2.49%202.49%200%200%201%202.502-2.492c.731%200%201.439.322%201.912.891l186.313%20223.096a31.95%2031.95%200%200%200%2024.357%2011.297h6.508c17.623%200%2031.927-14.272%2031.938-31.895V138.116c0-17.623-14.294-31.917-31.917-31.917%22%2F%3E%3C%2Fsvg%3E",
        heading: "NEAR Connector",
        link: "https://wallet.near.org",
        linkText: "Don't have a wallet?",
      };
    }

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

          if (this.autoConnect) {
            this.connect({ walletId: event.data.manifest.id });
          }
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

  async switchNetwork(network: "mainnet" | "testnet", connectOptions?: NearConnector_ConnectOptions) {
    if (this.network === network) return;
    await this.disconnect().catch(() => {});
    this.network = network;
    await this.connect(connectOptions);
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

  async selectWallet({ features = {} }: { features?: Partial<WalletFeatures> } = {}) {
    await this.whenManifestLoaded.catch(() => {});
    return new Promise<string>((resolve, reject) => {
      const popup = new NearWalletsPopup({
        footer: this.footerBranding,
        wallets: this.availableWallets.filter(createFilterForWalletFeatures(features)).map((wallet) => wallet.manifest),
        onRemoveDebugManifest: async (id: string) => this.removeDebugWallet(id),
        onAddDebugManifest: async (wallet: string) => this.registerDebugWallet(wallet),
        onReject: () => (reject(new Error("User rejected")), popup.destroy()),
        onSelect: (id: string) => (resolve(id), popup.destroy()),
      });

      popup.create();
    });
  }

  async connect(input: NearConnector_ConnectOptions = {}) {
    let walletId = input.walletId;
    const signMessageParams = input.signMessageParams;

    await this.whenManifestLoaded.catch(() => {});

    if (!walletId) {
      walletId = await this.selectWallet({
        features: {
          signInAndSignMessage: input.signMessageParams != null ? true : undefined,
          signInWithFunctionCallKey: input.addFunctionCallKey != null ? true : undefined,
        },
      });
    }

    try {
      const wallet = await this.wallet(walletId);
      this.logger?.log(`Wallet available to connect`, wallet);

      await this.storage.set("selected-wallet", walletId);
      this.logger?.log(`Set preferred wallet, try to signIn${signMessageParams != null ? " (with signed message)" : ""}`, walletId);

      let addFunctionCallKey: AddFunctionCallKeyParams | undefined = undefined;

      if (input.addFunctionCallKey != null) {
        this.logger?.log(`Adding function call access key during sign in with params`, input.addFunctionCallKey);

        // Set default gas allowance if not provided
        addFunctionCallKey = {
          ...input.addFunctionCallKey,
          gasAllowance: input.addFunctionCallKey.gasAllowance ?? {
            amount: "250000000000000000000000", // 0.25 NEAR in yoctoNEAR
            kind: "limited",
          },
        };
      }

      if (signMessageParams != null) {
        const accounts = await wallet.signInAndSignMessage({
          addFunctionCallKey,
          messageParams: signMessageParams,
          network: this.network,
        });

        if (!accounts?.length) throw new Error("Failed to sign in");

        this.logger?.log(`Signed in to wallet (with signed message)`, walletId, accounts);
        this.events.emit("wallet:signInAndSignMessage", { wallet, accounts, success: true });
        this.events.emit("wallet:signIn", {
          wallet,
          accounts: accounts.map((account) => ({
            accountId: account.accountId,
            publicKey: account.publicKey,
          })),
          success: true,
          source: "signInAndSignMessage",
        });
      } else {
        const accounts = await wallet.signIn({
          addFunctionCallKey,
          network: this.network,
        });

        if (!accounts?.length) throw new Error("Failed to sign in");

        this.logger?.log(`Signed in to wallet`, walletId, accounts);
        this.events.emit("wallet:signIn", { wallet, accounts, success: true, source: "signIn" });
      }
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

  async use(plugin: WalletPlugin): Promise<void> {
    await this.whenManifestLoaded.catch(() => {});

    this.wallets = this.wallets.map((wallet) => {
      return new Proxy(wallet, {
        get(target, prop, receiver) {
          const originalValue = Reflect.get(target, prop, receiver);

          // If plugin has this method and it's a function on the wallet
          if (prop in plugin && typeof originalValue === "function") {
            const pluginMethod = (plugin as any)[prop];

            // Act as middleware, can call next method in line via next()
            return function (this: any, ...args: any[]) {
              const next = () => originalValue.apply(target, args);
              // Pass all args if any exist, otherwise undefined
              // this ensures next is always the last param
              return args.length > 0 ? pluginMethod.call(this, ...args, next) : pluginMethod.call(this, undefined, next);
            };
          }

          return originalValue;
        },
      }) as NearWalletBase;
    });
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
