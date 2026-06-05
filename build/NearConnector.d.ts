import { EventEmitter } from "./helpers/events";
import { DataStorage } from "./helpers/storage";
import IndexedDB from "./helpers/indexdb";
import type { EventMap, WalletManifest, Network, WalletFeatures, Logger, NearWalletBase, AbstractWalletConnect, FooterBranding, NearConnector_ConnectOptions } from "./types";
import type { WalletPlugin } from "./types/plugin";
export interface NearConnectorOptions {
    providers?: {
        mainnet?: string[];
        testnet?: string[];
    };
    features?: Partial<WalletFeatures>;
    excludedWallets?: string[];
    autoConnect?: boolean;
    network?: Network;
    manifest?: string | {
        wallets: WalletManifest[];
        version: string;
    };
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
    signIn?: {
        contractId?: string;
        methodNames?: Array<string>;
    };
}
export declare class NearConnector {
    private storage;
    readonly events: EventEmitter<EventMap>;
    readonly db: IndexedDB;
    logger?: Logger;
    wallets: NearWalletBase[];
    manifest: {
        wallets: WalletManifest[];
        version: string;
    };
    features: Partial<WalletFeatures>;
    network: Network;
    providers: {
        mainnet?: string[];
        testnet?: string[];
    };
    walletConnect?: Promise<AbstractWalletConnect> | AbstractWalletConnect;
    footerBranding: FooterBranding | null;
    excludedWallets: string[];
    autoConnect?: boolean;
    cspNonce?: string;
    readonly whenManifestLoaded: Promise<void>;
    constructor(options?: NearConnectorOptions);
    get availableWallets(): NearWalletBase[];
    private _handleNearWalletInjected;
    private _loadManifest;
    switchNetwork(network: "mainnet" | "testnet", connectOptions?: NearConnector_ConnectOptions): Promise<void>;
    registerWallet(manifest: WalletManifest): Promise<void>;
    registerDebugWallet(json: string | WalletManifest): Promise<WalletManifest>;
    removeDebugWallet(id: string): Promise<void>;
    selectWallet({ features }?: {
        features?: Partial<WalletFeatures>;
    }): Promise<string>;
    connect(input?: NearConnector_ConnectOptions): Promise<NearWalletBase>;
    disconnect(wallet?: NearWalletBase): Promise<void>;
    getConnectedWallet(): Promise<{
        wallet: NearWalletBase;
        accounts: import("./types").Account[];
    }>;
    wallet(id?: string | null): Promise<NearWalletBase>;
    use(plugin: WalletPlugin): Promise<void>;
    on<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void;
    once<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void;
    off<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): void;
    removeAllListeners<K extends keyof EventMap>(event?: K): void;
}
