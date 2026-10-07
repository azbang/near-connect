import { baseEncode } from "@near-js/utils";
import { QRCode } from "@here-wallet/core/qrcode-strategy";
import crypto from "crypto";

import { head, bodyMobile, bodyDesktop } from "./view";
import { ConnectorAction } from "../utils/action";
import type { SignInParams, SignInAndSignMessageParams } from "../utils/types";

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const logoImage = new Image();
logoImage.src = "https://hot-labs.org/hot-widget/icon.svg";

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

// near-connect before 0.11.5 opens links with window.open, which Telegram Mini App blocks,
// so reach the Telegram bridge of the dApp page directly (manifest permissions.external).
// Works with telegram-web-app.js loaded by the dApp, or with the raw bridge on iOS/Android
const openViaTelegram = async (link: string) => {
  const url = new URL(link);
  const isTgLink = url.hostname === "t.me";

  try {
    const platform = await window.selector.external("Telegram.WebApp", "platform");
    if (platform && platform !== "unknown") {
      await window.selector.external("Telegram.WebApp", isTgLink ? "openTelegramLink" : "openLink", link);
      return true;
    }
  } catch {}

  try {
    const event = isTgLink ? "web_app_open_tg_link" : "web_app_open_link";
    const data = isTgLink ? { path_full: url.pathname + url.search } : { url: link };
    await window.selector.external("TelegramWebviewProxy", "postEvent", event, JSON.stringify(data));
    return true;
  } catch {}

  return false;
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

    const query = baseEncode(
      JSON.stringify({
        ...request,
        deadline: timestamp + 60_000,
        id: uuid4(),
        $hot: true,
        origin,
      })
    );

    const hashsum = crypto.createHash("sha1").update(query).digest("hex");
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
    const qrcode = new QRCode({
      value: `https://app.hot-labs.org/link?${link}`,
      logo: logoImage,
      size: 140,
      radius: 0.8,
      ecLevel: "H",

      fill: {
        type: "linear-gradient",
        position: [0, 0, 1, 1],
        colorStops: [
          [0, "#fff"],
          [0.34, "#fff"],
          [1, "#fff"],
        ],
      },

      withLogo: true,
      imageEcCover: 0.3,
      quiet: 1,
    });

    qrcode.render();
    qr?.appendChild(qrcode.canvas);

    const actions: Record<string, () => void> = {
      telegram: async () => {
        const url = `https://t.me/hot_wallet/app?startapp=${link}`;
        if (!(await openViaTelegram(url))) window.selector.open(url);
      },
      extension: () => window.selector.open(`https://download.hot-labs.org?hotconnector`),
      mobile: async () => {
        // Telegram does not open custom schemes, the universal link opens the app or the web fallback
        if (!(await openViaTelegram(`https://app.hot-labs.org/link?${link}`))) window.selector.openNativeApp(`hotwallet://${link}`);
      },
    };

    // No inline onclick: the sandbox inherits the dApp CSP, and without 'unsafe-inline' inline handlers never run
    document.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
      el.addEventListener("click", () => actions[el.dataset.action!]?.());
    });

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
    const result = await HOT.shared.request("near:signIn", {
      addFunctionCallKey: data.addFunctionCallKey,
    });
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

  signDelegateActions = async (data: any) => {
    if (data.network === "testnet") throw "HOT Wallet not supported on testnet";
    const result = await HOT.shared.request("near:signDelegateActions", {
      delegateActions: data.delegateActions,
    });
    return result;
  };

  signInAndSignMessage = async (data: SignInAndSignMessageParams) => {
    if (data.network === "testnet") throw "HOT Wallet not supported on testnet";
    const result = await HOT.shared.request("near:signInAndSignMessage", {
      messageParams: {
        message: data.messageParams.message,
        recipient: data.messageParams.recipient,
        nonce: Array.from(data.messageParams.nonce),
      },
    });
    window.selector.storage.set("hot-account", JSON.stringify({ accountId: result.accountId, publicKey: result.publicKey }));
    return [result];
  };
}

window.selector.ready(new NearWallet());
