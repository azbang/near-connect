import { NearMobileWallet } from "@peersyst/near-mobile-signer/dist/src/wallet/NearMobileWallet";
import { RepositoryErrorCodes } from "@peersyst/near-mobile-signer/src/data-access/errors/index";
import { Network, SessionState } from "@peersyst/near-mobile-signer/src/common/models";
import { NearMobileStrategy } from "@peersyst/near-mobile-signer/dist/src/wallet/NearMobileWallet.types";
import config from "@peersyst/near-mobile-signer/dist/src/common/config/config";
import QRCodeStyling from "qr-code-styling";
import { KeyPair } from "@near-js/crypto";

import { nearMobileFrame, nearMobileFrameHead } from "./view";
import { ConnectorAction } from "../utils/action";

const isMobile = function () {
  let check = false;
  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
        a
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        a.substr(0, 4)
      )
    )
      check = true; // @ts-ignore
  })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
};

document.head.innerHTML = nearMobileFrameHead;
const connector = document.createElement("div");
connector.innerHTML = nearMobileFrame;
document.body.appendChild(connector);

const approveButton = document.getElementById("approve-button");
if (approveButton) approveButton.style.display = "none";

async function setQRCode({ requestUrl }: { requestUrl: string }) {
  const qrCodeParent = document.getElementById("qr-code");
  qrCodeParent!.innerHTML = "";

  const qrCode = new QRCodeStyling({
    width: 180,
    height: 180,
    type: "svg",
    data: requestUrl,
    dotsOptions: { color: "#FFFFFF" },
    backgroundOptions: { color: "transparent" },
    cornersSquareOptions: { color: "#FFFFFF" },
  });

  qrCode.append(qrCodeParent!);

  if (isMobile() && approveButton) {
    const urlParts = requestUrl.split("/");
    const id = urlParts[urlParts.length - 1];
    const type = urlParts[urlParts.length - 2];

    approveButton!.style.display = "flex";
    approveButton!.onclick = () => {
      window.selector.open(`https://near-mobile-signer-backend.peersyst.tech/api/deep-link?uuid=${id}&type=${type}`);
    };
  }
}

export class WidgetStrategy implements NearMobileStrategy {
  constructor() {}

  onRequested(id: string, request: any, onClose?: () => Promise<void>): void {
    const requestType = "message" in request ? "message" : "request";
    const requestUrl = `${config.nearMobileWalletUrl}/${requestType}/${id}`;
    setQRCode({ requestUrl });
  }
}

export class SessionRepository {
  constructor() {
    this.loadSessionState();
  }

  async get() {
    try {
      const sessionData = await window.selector.storage.get("session");
      if (!sessionData)
        return {
          mainnet: { activeAccount: null, accounts: {} },
          testnet: { activeAccount: null, accounts: {} },
        };

      return JSON.parse(sessionData);
    } catch {
      return {
        mainnet: { activeAccount: null, accounts: {} },
        testnet: { activeAccount: null, accounts: {} },
      };
    }
  }

  async set(session: SessionState) {
    await window.selector.storage.set("session", JSON.stringify(session));
  }

  async clear() {
    await window.selector.storage.remove("session");
  }

  private async loadSessionState(): Promise<void> {
    const currentSessionState = await this.get();
    if (!currentSessionState)
      await this.set({
        mainnet: { activeAccount: null, accounts: {} },
        testnet: { activeAccount: null, accounts: {} },
      });
  }

  async getKey(network: Network, accountId: string): Promise<KeyPair> {
    const sessionState = await this.get();
    const privateKey = sessionState[network]?.accounts[accountId];
    if (!privateKey) throw new Error(RepositoryErrorCodes.ACCOUNT_KEY_NOT_FOUND);
    return KeyPair.fromString(privateKey);
  }

  async setKey(network: Network, accountId: string, accessKey: KeyPair): Promise<void> {
    const sessionState = await this.get();

    sessionState[network].accounts[accountId] = accessKey.toString();
    await this.set(sessionState);
  }

  async removeKey(network: Network, accountId: string): Promise<void> {
    const sessionState = await this.get();
    if (sessionState[network].activeAccount === accountId) sessionState[network].activeAccount = null;
    delete sessionState[network].accounts[accountId];
    await this.set(sessionState);
  }

  async getActiveAccount(network: Network): Promise<string> {
    const sessionState = await this.get();
    return sessionState[network].activeAccount;
  }

  async setActiveAccount(network: Network, accountId: string): Promise<void> {
    const sessionState = await this.get();
    const accountExists = Object.keys(sessionState[network].accounts).includes(accountId);
    if (!accountExists) throw new Error(RepositoryErrorCodes.INVALID_ACCOUNT_ID);
    sessionState[network].activeAccount = accountId;
    await this.set(sessionState);
  }

  async getAccounts(network: Network): Promise<string[]> {
    const sessionState = await this.get();
    const accounts = sessionState[network].accounts;
    return Object.keys(accounts);
  }

  async getNetworks(): Promise<string[]> {
    const sessionState = await this.get();
    return Object.keys(sessionState);
  }
}

export const initNearMobileWallet = async () => {
  const wallet = {
    mainnet: new NearMobileWallet({ network: "mainnet", sessionRepository: new SessionRepository() as any }),
    testnet: new NearMobileWallet({ network: "testnet", sessionRepository: new SessionRepository() as any }),
  };

  // @ts-ignore
  wallet.mainnet.defaultStrategy = new WidgetStrategy();
  // @ts-ignore
  wallet.testnet.defaultStrategy = new WidgetStrategy();

  async function getAccounts(network: Network) {
    const accountIds = await wallet[network].getAccounts();
    const accounts: { accountId: string; publicKey: string }[] = [];

    for (let i = 0; i < accountIds.length; i++) {
      const publicKey = await wallet[network].signer.getPublicKey(accountIds[i], network);
      accounts.push({ accountId: accountIds[i], publicKey: publicKey.toString() });
    }

    return accounts;
  }

  return {
    async signIn(data: { network: Network; contractId?: string; methodNames?: Array<string> }) {
      window.selector.ui.showIframe();
      await wallet[data.network].signIn({ contractId: data.contractId, methodNames: data.methodNames });
      return await getAccounts(data.network);
    },

    async signOut({ network }: { network: Network }) {
      window.selector.ui.showIframe();
      await wallet[network].signOut();
    },

    async getAccounts({ network }: { network: Network }) {
      return getAccounts(network);
    },

    async signAndSendTransaction(data: { network: Network; receiverId: string; actions: ConnectorAction[] }) {
      window.selector.ui.showIframe();
      return await wallet[data.network].signAndSendTransaction({ actions: data.actions as any, receiverId: data.receiverId });
    },

    async verifyOwner() {
      throw Error("[NearMobileWallet]: verifyOwner is deprecated, use signMessage method with implementation NEP0413 Standard");
    },

    async signMessage(data: { network: Network; recipient: string; message: string; nonce: number[] }) {
      window.selector.ui.showIframe();
      const { recipient, nonce, ...rest } = data;
      const result = await wallet[data.network].signMessage({ ...rest, receiver: recipient, nonce: Array.from(nonce) });
      return {
        accountId: result.accountId,
        signature: result.signature.toString(),
        publicKey: result.publicKey.toString(),
      };
    },

    async signAndSendTransactions(data: { network: Network; transactions: { receiverId: string; actions: ConnectorAction[] }[] }) {
      window.selector.ui.showIframe();
      return await wallet[data.network].signAndSendTransactions({ transactions: data.transactions as any });
    },
  };
};

initNearMobileWallet().then((wallet) => {
  window.selector.ready(wallet);
});
