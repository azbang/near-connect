import { createQRSvg } from "../utils/qr";

import { head, bodyMobile, bodyDesktop } from "./view";
import type { ConnectorAction } from "../utils/action";
import type { SignInParams } from "../utils/types";

// Inline base58 encoder (Bitcoin alphabet) — replaces @near-js/utils baseEncode
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) { zeros++; i++; }
  let digits: number[] = [0];
  for (; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  while (digits.length > 0 && digits[digits.length - 1] === 0) digits.pop();
  let result = "";
  for (let k = 0; k < zeros; k++) result += BASE58_ALPHABET[0];
  for (let q = digits.length - 1; q >= 0; --q) result += BASE58_ALPHABET[digits[q]];
  return result;
}

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const renderUI = () => {
  const root = document.createElement("div");
  root.style.height = "100%";
  document.body.appendChild(root);
  document.head.innerHTML = head;

  if (isMobile()) root.innerHTML = bodyMobile;
  else root.innerHTML = bodyDesktop;
};

export const proxyApi = "https://h4n.app";

export const uuid4 = () => {
  return window.crypto.randomUUID();
};

export const wait = (timeout: number) => {
  return new Promise<void>((resolve) => setTimeout(resolve, timeout));
};

export class RequestFailed extends Error {
  name = "RequestFailed";
  constructor(readonly payload: any) {
    super();
  }
}

class HOT {
  static shared = new HOT();

  async getTimestamp() {
    const { ts } = await fetch("https://api0.herewallet.app/api/v1/web/time").then((res) => res.json());
    const seconds = BigInt(ts) / 10n ** 12n;
    return Number(seconds) * 1000;
  }

  async getResponse(id: string) {
    const res = await fetch(`${proxyApi}/${id}/response`, {
      headers: { "content-type": "application/json" },
      method: "GET",
    });

    if (res.ok === false) throw Error(await res.text());
    const { data } = await res.json();
    return JSON.parse(data);
  }

  async computeRequestId(request: object) {
    const origin = window.selector.location;
    const timestamp = await this.getTimestamp().catch(() => Date.now());

    const query = encodeBase58(
      new TextEncoder().encode(
        JSON.stringify({
          ...request,
          deadline: timestamp + 60_000,
          id: uuid4(),
          $hot: true,
          origin,
        })
      )
    );

    const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(query));
    const hashsum = [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { requestId: hashsum, query };
  }

  async createRequest(request: object, signal?: AbortSignal) {
    const { query, requestId } = await this.computeRequestId(request);
    const res = await fetch(`${proxyApi}/${requestId}/request`, {
      body: JSON.stringify({ data: query }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });

    if (res.ok === false) throw Error(await res.text());
    return requestId;
  }

  async request(method: string, request: any): Promise<any> {
    renderUI();
    const qr = document.querySelector(".qr-code");
    if (qr) qr.innerHTML = "";

    window.selector.ui.showIframe();
    const requestId = await this.createRequest({ method, request });
    const link = `hotcall-${requestId}`;
    qr!.appendChild(createQRSvg(`https://app.hot-labs.org/link?${link}`, 140));

    // @ts-ignore
    window.openTelegram = () => window.selector.open(`https://t.me/hot_wallet/app?startapp=${link}`); // @ts-ignore
    window.openExtension = () => window.selector.open(`https://download.hot-labs.org?hotconnector`); // @ts-ignore
    window.openMobile = () => window.selector.open(`hotwallet://${link}`);

    const poolResponse = async () => {
      await wait(3000);
      const data: any = await this.getResponse(requestId).catch(() => null);
      if (data == null) return await poolResponse();
      if (data.success) return data.payload;
      throw new RequestFailed(data.payload);
    };

    const result = await poolResponse();
    return result;
  }
}

class NearWallet {
  getAccounts = async (data: any) => {
    if (data.network === "testnet") throw "HOT Wallet not supported on testnet";
    const hotAccount = await window.selector.storage.get("hot-account");
    if (hotAccount) return [JSON.parse(hotAccount)];
    return [];
  };

  signIn = async (data: SignInParams) => {
    if (data.network === "testnet") throw "HOT Wallet not supported on testnet";
    const result = await HOT.shared.request("near:signIn", {});
    window.selector.storage.set("hot-account", JSON.stringify(result));
    return [result];
  };

  signOut = async (data: any) => {
    if (data.network === "testnet") throw "HOT Wallet not supported on testnet";
    await window.selector.storage.remove("hot-account");
  };

  signMessage = async (payload: any) => {
    if (payload.network === "testnet") throw "HOT Wallet not supported on testnet";
    const res = await HOT.shared.request("near:signMessage", payload);
    return res;
  };

  signAndSendTransaction = async (payload: { network: string; receiverId: string; actions: ConnectorAction[] }) => {
    if (payload.network === "testnet") throw "HOT Wallet not supported on testnet";
    const { transactions } = await HOT.shared.request("near:signAndSendTransactions", { transactions: [payload] });
    return transactions[0];
  };

  signAndSendTransactions = async (payload: { network: string; transactions: { receiverId: string; actions: ConnectorAction[] }[] }) => {
    if (payload.network === "testnet") throw "HOT Wallet not supported on testnet";
    const { transactions } = await HOT.shared.request("near:signAndSendTransactions", { transactions: payload.transactions });
    return transactions;
  };
}

window.selector.ready(new NearWallet());
