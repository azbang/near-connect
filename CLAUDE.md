# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEAR Connect (`@hot-labs/near-connect`) is a zero-runtime-dependency wallet connector for NEAR blockchain. Wallets run in sandboxed iframes via executor scripts, eliminating the need for a central wallet registry. The library is published as a CommonJS package with TypeScript declarations.

## Commands

- **Build library:** `yarn build` (compiles TS to `./build/`)
- **CDN bundle:** `yarn cdn` (Vite build to `./cdn/` in ES, CJS, IIFE formats)
- **Type check:** `yarn type-check`
- **Build wallet executors:** `yarn build:wallets` (builds each wallet executor to `./repository/`)
- **Run example app:** `yarn example` (starts React demo at `example/`)

There are no test scripts configured in this repository.

## Architecture

### Three-project structure

1. **Root (`./`)** — The main library published to npm
2. **`near-wallets/`** — Wallet executor implementations (separate package.json, builds to `./repository/`)
3. **`example/`** — React demo app (separate package.json)

### Core library (`src/`)

**`NearConnector`** (`src/NearConnector.ts`) is the main entry point — an EventEmitter-based class that manages wallet discovery, selection UI, connection lifecycle, and network switching. Events: `wallet:signIn`, `wallet:signOut`, `wallet:signInAndSignMessage`, `walletsChanged`.

Three wallet adapter types implement the `NearWalletBase` interface:

- **`SandboxWallet`** (`src/SandboxedWallet/`) — Runs wallet code in a sandboxed iframe. The executor script communicates via `postMessage` and accesses a restricted `window.selector` API (storage, URL opening, wallet registration). Permissions (storage, allowsOpen, walletConnect, location, external) are checked before each operation.
- **`InjectedWallet`** (`src/InjectedWallet.ts`) — Wraps wallets injected via EIP-6963-style custom events.
- **`ParentFrameWallet`** (`src/ParentFrameWallet.ts`) — Wraps wallets in a parent frame via postMessage.

**`src/actions/`** — Converts `@near-js/transactions` action objects to the library's `ConnectorAction` format. Supports both near-wallet-selector and near-api-js action formats.

**`src/popups/`** — DOM-based wallet selection modal UI and iframe container. Uses inline CSS with namespaced classes.

**`src/helpers/`** — Utilities: EventEmitter, LocalStorage, IndexedDB cache, base58, UUID, URL helpers, HTML sanitization, async queue.

### Wallet executors (`near-wallets/`)

Each wallet has its own entry point (e.g., `hotwallet/`, `mnw.ts`, `meteor.ts`). Vite builds each as a standalone IIFE to `./repository/`. The `repository/manifest.json` registry maps wallet metadata, feature capabilities, and permissions to executor URLs.

### Key design decisions

- Zero runtime dependencies — all wallet SDKs are bundled into executor scripts, not the main library
- TypeScript strict mode with Preact JSX (`jsxImportSource: "preact"`) for popup UI
- Prettier: 160 char line width, 2-space tabs
- Node 22.17.1, Yarn 1.22.22 (specified in `.prototools`)
