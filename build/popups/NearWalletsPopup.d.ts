import { FooterBranding, WalletManifest } from "../types";
import { Popup } from "./Popup";
export declare class NearWalletsPopup extends Popup<{
    wallets: WalletManifest[];
    showSettings: boolean;
}> {
    readonly delegate: {
        wallets: WalletManifest[];
        footer: FooterBranding | null;
        onAddDebugManifest: (wallet: string) => Promise<WalletManifest>;
        onRemoveDebugManifest: (id: string) => Promise<void>;
        onSelect: (id: string) => void;
        onReject: () => void;
    };
    constructor(delegate: {
        wallets: WalletManifest[];
        footer: FooterBranding | null;
        onAddDebugManifest: (wallet: string) => Promise<WalletManifest>;
        onRemoveDebugManifest: (id: string) => Promise<void>;
        onSelect: (id: string) => void;
        onReject: () => void;
    });
    handlers(): void;
    create(): void;
    walletDom(wallet: WalletManifest): import("../helpers/html").HtmlString;
    get footer(): import("../helpers/html").HtmlString | "";
    get dom(): import("../helpers/html").HtmlString;
}
