import { WalletManifest, WalletPermissions } from "../types";
import { NearConnector } from "../NearConnector";
import IframeExecutor from "./iframe";
declare class SandboxExecutor {
    readonly connector: NearConnector;
    readonly manifest: WalletManifest;
    private activePanels;
    readonly storageSpace: string;
    constructor(connector: NearConnector, manifest: WalletManifest);
    checkPermissions(action: keyof WalletPermissions, params?: {
        url?: string;
        entity?: string;
    }): boolean | undefined;
    assertPermissions(iframe: IframeExecutor, action: keyof WalletPermissions, event: MessageEvent): void;
    _onMessage: (iframe: IframeExecutor, event: MessageEvent) => Promise<void>;
    private actualCode;
    checkNewVersion(executor: SandboxExecutor, currentVersion: string | null): Promise<string>;
    loadCode(): Promise<string>;
    call<T>(method: string, params: any): Promise<T>;
    getAllStorage(): Promise<Record<string, any>>;
    clearStorage(): Promise<void>;
}
export default SandboxExecutor;
