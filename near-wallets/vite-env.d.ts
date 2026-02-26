/// <reference types="vite/client" />

interface Window {
  selector: {
    nearConnectVersion?: string;
    walletConnect: {
      connect: (params: EngineTypes.ConnectParams) => Promise<SessionTypes.Struct>;
      disconnect: (params: EngineTypes.DisconnectParams) => Promise<void>;
      request: (params: EngineTypes.RequestParams) => Promise<any>;
      getSession: () => Promise<SessionTypes.Struct>;
      getProjectId: () => Promise<string>;
    };

    providers: { mainnet: string[]; testnet: string[] };
    network: "testnet" | "mainnet";
    location: string;

    ready: (wallet: any) => void;
    external: (entity: string, key: string, ...args: any[]) => Promise<any>;

    parentFrame?: {
      postMessage: (data: any) => Promise<void>;
    };

    ui: {
      whenApprove: (options: { title: string; button: string }) => Promise<void>;
      showIframe: () => void;
    };

    open: (
      url: string,
      newTab?: boolean | string,
      options?: string
    ) => {
      close: () => void;
      postMessage: (message: any) => void;
      windowIdPromise: Promise<string | null>;
      closed: boolean;
    };

    showContent: () => void;
    storage: {
      set: (key: string, value: string) => Promise<void>;
      get: (key: string) => Promise<string>;
      remove: (key: string) => Promise<void>;
      keys: () => Promise<string[]>;
    };
  };
}

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}
