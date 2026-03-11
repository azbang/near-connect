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
      <h2 class="title">Approve in <span>App</span></h2>

      <div style="display: flex; gap: 12px;">
        <button class="button" style="white-space: nowrap; width: 140px; margin-top: 16px; margin-bottom: 32px" onclick="window.openMobile()">
           Open Mobile
        </button>

        <button class="button" style="white-space: nowrap; width: 140px; margin-top: 16px; margin-bottom: 32px" onclick="window.openTelegram()">
           Open Telegram
        </button>
      </div>

      <p class="text">
        Don’t have a wallet?<br />
        <a target="_blank" href="https://hot-labs.org/wallet/">Get extension • iOS • Android</a>
      </p>
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
