import { styles } from "./styles";

export const head = /* html */ `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="preconnect" href="https://fonts.cdnfonts.com/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <link
      rel="stylesheet"
      href="https://fonts.cdnfonts.com/css/cabinet-grotesk"
    />
    <style>${styles}</style>
    <title>NEAR Connector</title>
`;

export const bodyMobile = /* html */ `
    <div class="popup">

      <img src="https://storage.herewallet.app/upload/3390b7e4e15fed4122572898712bdf4c6ede862e36150203deecacc4f8bbe5ae.png" alt="HOT Wallet" class="logo" />
      <h2 class="title">Approve in <span>HOT Wallet</span></h2>

      <p class="text description">
        Open and continue <br/>
        in the Mobile App or Telegram app
      </p>

      <div style="display: flex; gap: 12px;">
        <button class="button simple" style="white-space: nowrap; width: 160px; margin-top: 16px; margin-bottom: 32px" onclick="window.openMobile()">
           Open Mobile
        </button>

        <button class="button simple reverse" style="white-space: nowrap; width: 160px; margin-top: 16px; margin-bottom: 32px" onclick="window.openTelegram()">
           Open Telegram
        </button>
      </div>

      <a class="get-button" href="https://hot-labs.org/wallet/" target="_blank">
        <p class="text get-button-text">
          Don’t have HOT wallet?
        </p>
        <div class="get-button-green">
          Get
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="#77c7bd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </a>
    </div>
`;

export const bodyDesktop = /* html */ `
    <div class="popup">
      <h1 class="title" style="margin-bottom: 14px">
        Scan in <span>HOT Wallet</span>
      </h1>
      
      <div class="qr-code"></div>

      <h2 class="divider">OR</h2>
      <h2 class="title">Approve in <span>App</span></h2>

      <div style="display: flex; gap: 12px;">
        <button class="button" style="width: 240px; margin-top: 16px; margin-bottom: 32px" onclick="window.openExtension()">
           Download Extension
        </button>
      </div>

      <p class="text">
        <a style="cursor: pointer" onclick="window.openTelegram()">Open via Telegram</a>
      </p>
    </div>
`;
