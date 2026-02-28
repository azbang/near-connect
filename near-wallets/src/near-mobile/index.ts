import { createNearMobileAdapter } from "@fastnear/wallet-adapter";
import QRCodeStyling from "qr-code-styling";

import { nearMobileFrame, nearMobileFrameHead } from "./view";
import type { ConnectorAction } from "../utils/action";

const NEAR_MOBILE_SIGNER_BACKEND = "https://near-mobile-signer-backend_production.peersyst.tech";
const NEAR_MOBILE_WALLET_URL = "near-mobile-wallet://sign";

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

    approveButton.style.display = "flex";
    approveButton.onclick = () => {
      window.selector.open(`${NEAR_MOBILE_SIGNER_BACKEND}/api/deep-link?uuid=${id}&type=${type}`);
    };
  }
}

const nearMobile = createNearMobileAdapter({
  signerBackendUrl: NEAR_MOBILE_SIGNER_BACKEND,
  nearMobileWalletUrl: NEAR_MOBILE_WALLET_URL,
  storage: {
    get: (key) => window.selector.storage.get(key),
    set: (key, value) => window.selector.storage.set(key, value),
    remove: (key) => window.selector.storage.remove(key),
  },
  getNetworkProviders: (network) => {
    const providers = window.selector?.providers?.[network];
    if (providers && providers.length > 0) return providers;
    return [network === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org"];
  },
  onRequested: ({ requestUrl }) => {
    setQRCode({ requestUrl });
  },
});

const NearMobileWallet = async () => {
  return {
    async signIn(data: { network: "mainnet" | "testnet"; contractId?: string; methodNames?: Array<string>; allowance?: string }) {
      window.selector.ui.showIframe();
      return nearMobile.signIn(data);
    },

    async signOut({ network }: { network: "mainnet" | "testnet" }) {
      window.selector.ui.showIframe();
      await nearMobile.signOut({ network });
    },

    async getAccounts({ network }: { network: "mainnet" | "testnet" }) {
      return nearMobile.getAccounts({ network });
    },

    async signAndSendTransaction({
      network,
      signerId,
      receiverId,
      actions,
    }: {
      network: "mainnet" | "testnet";
      signerId?: string;
      receiverId: string;
      actions: ConnectorAction[];
    }) {
      window.selector.ui.showIframe();
      return nearMobile.signAndSendTransaction({ network, signerId, receiverId, actions });
    },

    async verifyOwner() {
      throw Error("[NearMobileWallet]: verifyOwner is deprecated, use signMessage method with implementation NEP0413 Standard");
    },

    async signMessage({
      network,
      recipient,
      message,
      nonce,
      callbackUrl,
      state,
      accountId,
    }: {
      network: "mainnet" | "testnet";
      recipient: string;
      message: string;
      nonce: number[];
      callbackUrl?: string;
      state?: string;
      accountId?: string;
    }) {
      window.selector.ui.showIframe();
      const result = await nearMobile.signMessage({
        network,
        recipient,
        message,
        nonce: Array.from(nonce),
        callbackUrl,
        state,
        accountId,
      });

      return {
        accountId: result.accountId,
        signature: result.signature,
        publicKey: result.publicKey,
      };
    },

    async signAndSendTransactions({
      network,
      signerId,
      transactions,
    }: {
      network: "mainnet" | "testnet";
      signerId?: string;
      transactions: { receiverId: string; actions: ConnectorAction[] }[];
    }) {
      window.selector.ui.showIframe();
      return nearMobile.signAndSendTransactions({
        network,
        signerId,
        transactions,
      });
    },
  };
};

NearMobileWallet().then((wallet) => {
  window.selector.ready(wallet);
});
