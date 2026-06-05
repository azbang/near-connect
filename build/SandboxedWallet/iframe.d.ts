import SandboxExecutor from "./executor";
declare class IframeExecutor {
    readonly executor: SandboxExecutor;
    readonly origin: string;
    private iframe;
    private events;
    private popup;
    private handler;
    private readyPromiseResolve;
    readonly readyPromise: Promise<void>;
    constructor(executor: SandboxExecutor, code: string, onMessage: (iframe: IframeExecutor, event: MessageEvent) => void, cspNonce?: string);
    on(event: "close", callback: () => void): void;
    show(): void;
    hide(): void;
    postMessage(data: any): void;
    dispose(): void;
}
export default IframeExecutor;
