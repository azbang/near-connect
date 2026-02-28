# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEAR Connect (`@fastnear/near-connect`) is a zero-runtime-dependency wallet connector for NEAR blockchain. Wallets run in sandboxed iframes via executor scripts, eliminating the need for a central wallet registry. The library is published as a CommonJS package (`"type": "commonjs"`) with TypeScript declarations; current version is `0.10.x`.

## Commands

- **Build library:** `yarn build` (compiles TS to `./build/`)
- **CDN bundle:** `yarn cdn` (Vite build to `./cdn/` in ES, CJS, IIFE formats; global name `HOTConnect`)
- **Type check:** `yarn type-check`
- **Build wallet executors:** `yarn build:wallets` (builds each wallet executor to `./repository/`)
- **Build single executor:** `cd near-wallets && yarn build:mnw` (replace `mnw` with wallet name; `PACKAGE` env var is set inside each script)
- **Run example app:** `yarn example` (starts React demo at `example/`, port 1234)

There are no test scripts configured in this repository.

## Architecture

### Three-project structure

Each has its own `package.json`, `node_modules`, and `tsconfig.json`:

1. **Root (`./`)** — The main library published to npm as `@fastnear/near-connect`. Zero runtime dependencies (devDependencies on `@near-js/transactions` and `@near-js/types` are used only for the `src/actions/` converter types). Outputs to `./build/` (npm) and `./cdn/` (browser bundles).
2. **`near-wallets/`** — Wallet executor implementations. Each wallet is built as a standalone IIFE to `./repository/`. When `EXAMPLE=true` is set, outputs to `../example/public/repository` instead. Key devDependencies: `@fastnear/utils`, `@fastnear/wallet-adapter`, `@fastnear/borsh-schema`, `@noble/curves`, `@noble/hashes`, `borsh`, `@walletconnect/modal`, `@here-wallet/core`, `qr-code-styling`.
3. **`example/`** — React demo app with Tailwind CSS 4. Also contains `static.html`, a no-build-tools vanilla JS example.

### Core library (`src/`)

**`NearConnector`** (`src/NearConnector.ts`) is the main entry point — an EventEmitter-based class that manages wallet discovery, selection UI, connection lifecycle, and network switching.

Events: `wallet:signIn`, `wallet:signOut`, `wallet:signInAndSignMessage`, `selector:walletsChanged`, `selector:manifestUpdated`.

Key public methods: `connect()`, `disconnect()`, `wallet()`, `getConnectedWallet()`, `selectWallet()`, `addFunctionCallKey()`, `switchNetwork()`, `use()` (plugin middleware), `registerWallet()`, `registerDebugWallet()`, `removeDebugWallet()`. Event methods: `on()`, `once()`, `off()`, `removeAllListeners()`.

Key public properties: `wallets`, `manifest`, `features`, `network`, `providers`, `events`, `availableWallets` (getter), `whenManifestLoaded` (promise — resolves when wallet list is ready).

Constructor options (`NearConnectorOptions`): `network`, `manifest` (URL string or inline object), `providers`, `features`, `excludedWallets`, `autoConnect` (default `true`), `walletConnect`, `footerBranding` (default `null` — hidden), `storage`, `logger`, `events`, `signIn` (deprecated).

Three wallet adapter types implement the `NearWalletBase` interface:

- **`SandboxWallet`** (`src/SandboxedWallet/`) — Runs wallet code in a sandboxed iframe. The executor script communicates via `postMessage` and accesses a restricted `window.selector` API (storage, URL opening, wallet registration). Permissions: `storage`, `external`, `walletConnect`, `allowsOpen`, `clipboardRead`, `clipboardWrite`, `usb`, `hid`.
- **`InjectedWallet`** (`src/InjectedWallet.ts`) — Wraps wallets injected via `near-wallet-injected` custom events (EIP-6963-style).
- **`ParentFrameWallet`** (`src/ParentFrameWallet.ts`) — Wraps wallets in a parent frame, created when receiving `postMessage` with `type: "near-wallet-injected"`. Auto-connects if `autoConnect` is true.

**`src/actions/`** — `nearActionsToConnectorActions()` converts `@near-js/transactions` `Action` objects to the library's `ConnectorAction` format (one direction only). The `ConnectorAction` type uses `{ type, params }` discriminated unions (e.g. `{ type: "FunctionCall", params: { methodName, args, gas, deposit } }`).

**`src/popups/`** — DOM-based wallet selection modal UI and iframe container. Files: `Popup.ts` (base class), `NearWalletsPopup.ts` (wallet list), `IframeWalletPopup.ts` (executor iframe), `styles.ts` (inline CSS). Uses tagged template literals (`html` helper with auto-escaping) with namespaced classes.

**`src/helpers/`** — Utilities: EventEmitter (`events.ts`), LocalStorage (`storage.ts`), IndexedDB cache (`indexdb.ts`), base58 (`base58.ts`), UUID (`uuid.ts`), URL helpers (`url.ts`), HTML sanitization (`html.ts`), async queue (`queue.ts`).

**`src/types/plugin.ts`** — `WalletPlugin` type: a `Partial<NearWalletBase>` where each method receives a `next()` callback as the last argument, enabling middleware-style composition via `NearConnector.use()`.

### Wallet executors (`near-wallets/`)

Each wallet has its own entry point (e.g., `hotwallet/`, `mnw.ts`, `meteor.ts`). Vite builds each as a standalone IIFE to `./repository/`. The `PACKAGE` env var selects which wallet to build.

**Shared utilities in `near-wallets/src/utils/`:**
- **`rpc.ts`** — `NearRpc` class: a standalone RPC client using plain `fetch()` with retry logic, provider failover, and adaptive timeouts. No `@near-js/providers` dependency. Methods: `block()`, `query()`, `txStatus()`, `sendTransaction()`, `viewMethod()`, `sendJsonRpc()`.
- **`action.ts`** — Two converters: `connectorActionsToNearActions()` converts to `@near-js/transactions` `Action[]`; `connectorActionsToFastnearActions()` converts to the flat format expected by `@fastnear/utils` `mapTransaction()`. Also exports all `ConnectorAction` type definitions used by executor code.
- **`action-nearapi.ts`** — Backward-compat shim: `connectorActionsToNearApiJsActions()` simply delegates to `connectorActionsToNearActions()`. No longer uses `near-api-js`.
- **`keystore.ts`** — Key storage utilities.
- **`detectBrowser.ts`** — Browser detection.

**Executor list** (7 executors):

| Executor | Key dependencies | Notes |
|----------|-----------------|-------|
| `hotwallet` | `@here-wallet/core` | Has Preact UI (`view.ts`, `styles.ts`) |
| `mnw` | `@fastnear/utils`, `borsh` | Signs locally with function call keys via `@fastnear/utils` crypto |
| `meteor` | `@fastnear/wallet-adapter` | Uses `createMeteorAdapter()` |
| `near-mobile` | `@fastnear/wallet-adapter`, `qr-code-styling` | Uses `createNearMobileAdapter()`; has QR code UI (`view.ts`) |
| `nightly` | `@fastnear/utils`, `borsh` | Browser extension bridge via `window.selector.external` |
| `okx` | `NearRpc` (internal) | Browser extension bridge via `window.selector.external` (`okxwallet.near`) |
| `wallet-connect` | `@walletconnect/modal`, `@fastnear/utils`, `borsh` | WalletConnect v2 protocol |

**`repository/manifest.json`** — Registry (v1.1.0) mapping wallet metadata, features, platform links, permissions, and executor URLs. Contains 9 wallet entries: `hot-wallet`, `mynearwallet`, `meteor-wallet`, `intear-wallet` (external executor), `okx-wallet`, `near-mobile`, `nightly-wallet`, `wallet-connect`, `unity-wallet` (reuses `wallet-connect.js` executor). The `platform` field is an object keyed by platform name (e.g. `{ "android": "url", "ios": "url", "chrome": "url", "web": "url" }`).

### Type system (`src/types/`)

Key types exported from the library:
- `NearWalletBase` — Core wallet interface: `signIn`, `signInAndSignMessage`, `signOut`, `getAccounts`, `signAndSendTransaction`, `signAndSendTransactions`, `signMessage`, `signDelegateActions`, `addFunctionCallKey`
- `WalletManifest` — Wallet metadata: id, name, icon, executor URL, type, features, permissions, platform, debug flag
- `ConnectorAction` — Discriminated union: CreateAccount, DeployContract, FunctionCall, Transfer, Stake, AddKey, DeleteKey, DeleteAccount, UseGlobalContract, DeployGlobalContract
- `EventMap` — Event types: `wallet:signIn`, `wallet:signInAndSignMessage`, `wallet:signOut`, `selector:walletsChanged`, `selector:manifestUpdated`
- `Network` = `"mainnet" | "testnet"`
- `WalletPlugin` — Middleware type for `NearConnector.use()`
- `FooterBranding` — Optional branding for the wallet selector popup footer
- `SignMessageParams`, `SignedMessage`, `SignAndSendTransactionParams`, `SignAndSendTransactionsParams`, `SignDelegateActionParams`, `SignDelegateActionResult`, `AddFunctionCallKeyParams`, `AddFunctionCallKeyResult`

### CDN bundle

Built via `yarn cdn` using root `vite.config.ts`:
- `cdn/hot-connect.iife.js` — Browser global `HOTConnect` (for `<script>` tags)
- `cdn/hot-connect.es.js` — ES module
- `cdn/hot-connect.cjs.js` — CommonJS

Published to npm and available via jsDelivr: `https://cdn.jsdelivr.net/npm/@fastnear/near-connect/cdn/hot-connect.iife.js`

### Key design decisions

- Zero runtime dependencies — all wallet SDKs are bundled into executor scripts, not the main library
- `NearRpc` is a standalone class using plain `fetch()` — no `@near-js/providers` dependency
- Executors use `@fastnear/utils` and `@fastnear/wallet-adapter` for crypto/signing/adapter logic; `near-api-js` has been fully removed
- `@noble/curves` and `@noble/hashes` are v2 (ESM-only); Vite handles them at build time, no CJS runtime concern
- Manifest can be provided inline (for cherry-picking wallets) or loaded from URL
- `window.selector` is the sandboxed API surface exposed to executor iframes

## Style and formatting

- Prettier: 160 char line width, 2-space indent (`.prettierrc`)
- ESLint with TypeScript and React hooks (`eslint:recommended`, `@typescript-eslint/recommended`, `react-hooks/recommended`)
- Node 22.17.1, Yarn 1.22.22 (specified in `.prototools`)

## npm publishing

- Package name: `@fastnear/near-connect`
- Main: `./build/index.js`, Types: `./build/index.d.ts`
- Only `build/` directory is published (`"files": ["build"]`)
- CDN artifacts and wallet executors (`repository/`) are committed to git but not published to npm
