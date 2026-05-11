---
name: near-connect-quickstart
description: >
  Install and set up @hot-labs/near-connect for NEAR blockchain wallet connection.
  Covers NearConnector initialization, connect/disconnect, wallet:signIn and
  wallet:signOut events, feature filtering, WalletConnect configuration, and
  manifest auto-updating. Use when adding NEAR wallet support to a dapp,
  configuring WalletConnect for mobile wallets, or troubleshooting wallet
  visibility issues.
type: lifecycle
library: near-connect
library_version: "0.11.3"
sources:
  - "hot-dao/near-selector:README.md"
  - "hot-dao/near-selector:src/NearConnector.ts"
  - "hot-dao/near-selector:src/types/index.ts"
---

# NEAR Connect — Quickstart

Zero-dependency wallet connector for NEAR blockchain. Wallets run in sandboxed iframes for security and auto-update via a remote manifest — no app redeploy needed when wallets change.

## Setup

```typescript
import { NearConnector } from "@hot-labs/near-connect";

const connector = new NearConnector({
  network: "mainnet",
});

await connector.whenManifestLoaded;

connector.on("wallet:signIn", (t) => {
  const address = t.accounts[0].accountId;
  const source = t.source;
});

connector.on("wallet:signOut", () => {
});

await connector.connect();
```

Install:

```bash
yarn add @hot-labs/near-connect
```

For mobile wallets that require WalletConnect:

```typescript
import SignClient from "@walletconnect/sign-client";

const wc = await SignClient.init({
  projectId: "your-walletconnect-project-id",
  metadata: {
    name: "My App",
    description: "My NEAR dapp",
    url: window.location.origin,
    icons: ["https://example.com/icon.png"],
  },
});

const connector = new NearConnector({
  network: "mainnet",
  walletConnect: wc,
});
```

## Core Patterns

### Filter wallets by features

Only show wallets that support specific capabilities:

```typescript
const connector = new NearConnector({
  network: "mainnet",
  features: { signMessage: true, testnet: true },
});
```

Available features: `signMessage`, `signTransaction`, `signAndSendTransaction`, `signAndSendTransactions`, `signInWithoutAddKey`, `signInAndSignMessage`, `signInWithFunctionCallKey`, `signDelegateActions`, `mainnet`, `testnet`.

### Connect with signed message verification

Sign a message during sign-in to verify account ownership in one wallet interaction:

```typescript
const nonce = crypto.getRandomValues(new Uint8Array(32));

await connector.connect({
  signMessageParams: {
    message: "Sign in to My App",
    recipient: "My App",
    nonce,
  },
});

connector.on("wallet:signInAndSignMessage", (t) => {
  const accountId = t.accounts[0].accountId;
  const signedMessage = t.accounts[0].signedMessage;
});
```

### Get connected wallet and accounts

```typescript
const wallet = await connector.wallet();
const accounts = await wallet.getAccounts();
```

### Switch network

```typescript
await connector.switchNetwork("testnet");
```

This disconnects the current wallet and reconnects on the new network.

### Customize or disable branding

```typescript
new NearConnector({
  footerBranding: { icon: "https://example.com/logo.svg", heading: "My App", link: "https://example.com", linkText: "Get a wallet" },
});

new NearConnector({ footerBranding: null });
```

## Manifest and Wallet Freshness

Wallets are loaded from a remote manifest JSON. The connector fetches it on construction and caches executor code in IndexedDB. When a wallet updates its executor script, the connector fetches the new version on next use — no app redeploy needed.

To add a wallet to the ecosystem, submit a PR updating `repository/manifest.json` in the near-selector repo. After review, the wallet appears for all dapps automatically.

Some wallets may fall behind — their executor scripts can become stale or buggy. The connector has no built-in staleness detection. If a wallet's executor is outdated or broken, the issue is in the wallet's hosted script, not in near-connect. Contact the wallet team to update their executor URL.

## Common Mistakes

### CRITICAL Using near-wallet-selector API instead of near-connect

Wrong:

```typescript
import { setupWalletSelector } from "@near-wallet-selector/core";
const selector = await setupWalletSelector({ modules: [...] });
```

Correct:

```typescript
import { NearConnector } from "@hot-labs/near-connect";
const connector = new NearConnector({ network: "mainnet" });
```

near-wallet-selector is a different package with a completely different API. @hot-labs/near-connect uses a single `NearConnector` class, not a modular setup system.

Source: https://github.com/hot-dao/near-selector

### HIGH Not awaiting manifest loading before calling connect

Wrong:

```typescript
const connector = new NearConnector({ network: "mainnet" });
await connector.connect();
```

Correct:

```typescript
const connector = new NearConnector({ network: "mainnet" });
await connector.whenManifestLoaded;
await connector.connect();
```

The manifest loads asynchronously in the constructor. Calling `connect()` before it resolves finds no wallets and throws.

Source: src/NearConnector.ts:89-137

### HIGH Omitting WalletConnect config causes wallets to silently disappear

Wrong:

```typescript
const connector = new NearConnector({ network: "mainnet" });
```

Correct:

```typescript
const wc = await SignClient.init({ projectId: "your-id", metadata: { name: "My App" } });
const connector = new NearConnector({ network: "mainnet", walletConnect: wc });
```

Wallets that require WalletConnect are filtered out of the manifest when no `walletConnect` option is provided. No error is thrown — they simply don't appear in `availableWallets`.

Source: src/NearConnector.ts:128-133

### HIGH Using library in SSR without guarding browser APIs

Wrong:

```typescript
import { NearConnector } from "@hot-labs/near-connect";
const connector = new NearConnector();
```

Correct:

```typescript
if (typeof window !== "undefined") {
  const { NearConnector } = await import("@hot-labs/near-connect");
  const connector = new NearConnector();
}
```

NearConnector uses `window`, `document`, `localStorage`, and `IndexedDB`. Constructing it during server-side render throws.

Source: src/NearConnector.ts:139-155

### MEDIUM Using deprecated signIn constructor option

Wrong:

```typescript
new NearConnector({ signIn: { contractId: "game.near", methodNames: ["action"] } });
```

Correct:

```typescript
await connector.connect({
  addFunctionCallKey: {
    contractId: "game.near",
    publicKey: "ed25519:...",
    allowMethods: { anyMethod: false, methodNames: ["action"] },
  },
});
```

The `signIn` constructor option is deprecated. It requires an on-chain transaction during initial connection, which hurts UX. Use `addFunctionCallKey` in `connect()` instead, ideally after the user has started interacting with your app.

Source: src/NearConnector.ts:46-52

### MEDIUM Not listening for signOut to detect wallet disconnection

Wrong:

```typescript
connector.on("wallet:signIn", (t) => {
  setAddress(t.accounts[0].accountId);
});
```

Correct:

```typescript
connector.on("wallet:signIn", (t) => {
  setAddress(t.accounts[0].accountId);
});
connector.on("wallet:signOut", () => {
  setAddress(null);
});
```

A wallet can disconnect externally (user removes access in wallet app). Without listening for `wallet:signOut`, the app shows a connected state with stale account data.

Source: src/types/index.ts:212-218

## Version

Targets @hot-labs/near-connect v0.11.3.

See also: near-connect-transactions/SKILL.md — signing transactions and messages after wallet connection
