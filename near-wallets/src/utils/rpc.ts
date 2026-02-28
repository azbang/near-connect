// Inline base64 encoder to avoid pulling @fastnear/utils (and js-base64) into all executors
const _bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

// Inline JSON-to-base64 for viewMethod args (replaces Buffer.from(str, "utf8").toString("base64"))
const _stringToBase64 = (str: string): string => _bytesToBase64(new TextEncoder().encode(str));

let _nextId = 123;

class RpcError extends Error {
  type: string;
  constructor(message: string, type: string) {
    super(message);
    this.type = type;
  }
}

class NetworkError extends Error {
  constructor(status: number, title: string, message: string) {
    super(`${status} ${title}: ${message}`);
  }
}

class TimeoutNetworkError extends NetworkError {
  constructor(title: string) {
    super(0, title, "Timeout error");
  }
}

const wait = (timeout: number) => {
  return new Promise<void>((resolve) => setTimeout(resolve, timeout));
};

const c1 = Math.random() > 0.5;
export const rpcProviders = [
  "https://relmn.aurora.dev",
  "https://nearrpc.aurora.dev",
  c1 ? "https://c1.rpc.fastnear.com" : "https://c2.rpc.fastnear.com",
  c1 ? "https://c2.rpc.fastnear.com" : "https://c1.rpc.fastnear.com",
];

export class NearRpc {
  public providers: string[];
  public currentProviderIndex = 0;
  public startTimeout;

  constructor(providers = rpcProviders, private timeout = 30_000, private triesCountForEveryProvider = 3, private incrementTimout = true) {
    this.currentProviderIndex = 0;
    this.providers = providers.length > 0 ? providers : rpcProviders;
    this.startTimeout = timeout;
  }

  async block(params: { finality: string }): Promise<any> {
    return this.sendJsonRpc("block", params);
  }

  async query<T = any>(params: Record<string, any>): Promise<T> {
    return this.sendJsonRpc("query", params);
  }

  async txStatus(txHash: string, accountId: string, waitUntil?: string): Promise<any> {
    return this.sendJsonRpc("tx", { tx_hash: txHash, sender_account_id: accountId, wait_until: waitUntil });
  }

  async sendTransaction(signedTransaction: { encode(): Uint8Array }): Promise<any> {
    const bytes = signedTransaction.encode();
    return this.sendJsonRpc("send_tx", { signed_tx_base64: _bytesToBase64(new Uint8Array(bytes)), wait_until: "EXECUTED_OPTIMISTIC" });
  }

  async viewMethod(args: { contractId: string; methodName: string; args: any }) {
    const payload = _stringToBase64(JSON.stringify(args.args));
    const data: any = await this.query({
      args_base64: payload,
      finality: "optimistic",
      request_type: "call_function",
      method_name: args.methodName,
      account_id: args.contractId,
    });

    return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result)));
  }

  async sendJsonRpc<T>(method: string, params: any, attempts = 0): Promise<T> {
    const url = this.providers[this.currentProviderIndex];
    const requestStart = Date.now();

    try {
      const result = await this.send<T>(method, params, url, this.timeout);
      this.timeout = Math.max(this.startTimeout, this.timeout / 1.2);
      return result;
    } catch (error: any) {
      if (error instanceof TimeoutNetworkError && this.incrementTimout) {
        this.timeout = Math.min(60_000, this.timeout * 1.2);
      }

      if (error instanceof NetworkError) {
        this.currentProviderIndex += 1;
        if (this.providers[this.currentProviderIndex] == null) {
          this.currentProviderIndex = 0;
        }
        if (attempts + 1 > this.providers.length * this.triesCountForEveryProvider) {
          throw error;
        }

        const needTime = 500 * attempts;
        const spent = Date.now() - requestStart;

        if (spent < needTime) {
          await wait(needTime - spent);
        }
        return await this.sendJsonRpc(method, params, attempts + 1);
      }

      throw error;
    }
  }

  async send<T>(method: string, params: any, url: string, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const req = await fetch(url, {
      body: JSON.stringify({ method, params, id: _nextId++, jsonrpc: "2.0" }),
      headers: { "Content-Type": "application/json", Referer: "https://my.herewallet.app" },
      signal: controller.signal,
      method: "POST",
    }).catch(() => {
      clearInterval(timer);
      if (controller.signal.aborted) {
        throw new TimeoutNetworkError("RPC Network Error");
      }
      if (!window.navigator.onLine) {
        throw new NetworkError(0, "RPC Network Error", "No internet connection");
      }
      throw new NetworkError(0, "RPC Network Error", "Unknown Near RPC Error, maybe connection unstable, try VPN");
    });

    clearInterval(timer);
    if (!req.ok) {
      const text = await req.text().catch(() => "Unknown error");
      throw new NetworkError(req.status, "RPC Network Error", text);
    }

    const response = await req.json();

    if (response.error) {
      if (typeof response.error.data === "object") {
        const isReadable = typeof response.error.data.error_message === "string" && typeof response.error.data.error_type === "string";
        if (isReadable) {
          throw new RpcError(response.error.data.error_message, response.error.data.error_type);
        }
        throw new RpcError(JSON.stringify(response.error.data), "ServerError");
      }

      // NOTE: All this hackery is happening because structured errors not implemented
      // TODO: Fix when https://github.com/nearprotocol/nearcore/issues/1839 gets resolved
      const errorMessage = `[${response.error.code}] ${response.error.message}: ${response.error.data}`;
      const isTimeout = response.error.data === "Timeout" || errorMessage.includes("Timeout error") || errorMessage.includes("query has timed out");

      if (isTimeout) {
        throw new RpcError(errorMessage, "TimeoutError");
      }
      throw new RpcError(errorMessage, response.error.name || "UntypedError");
    }

    return response.result;
  }
}

export const rpc = new NearRpc();
