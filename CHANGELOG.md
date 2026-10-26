# 0.12.0

- `IframeExecutor` dispose guard: `postMessage` after the wallet popup is rejected/disposed is now a silent no-op instead of throwing "Iframe not loaded" (surfaced as broken wallet login flows when a popup was dismissed mid-request, notably on Windows). If the iframe is alive but its `contentWindow` is missing, the error now names the method: "Iframe not loaded for \<method\>".
- Popups: Escape closes the popup with the same semantics as clicking the backdrop, and `destroy()` disposes document-level listeners so they cannot leak per popup open.
- MNW executor: an empty `providers` array from the page is now treated as "no providers" (falling back to the network's own node URL) instead of being passed to `NearRpc` as-is, which silently routed testnet RPC calls to mainnet.
- **Security: `nearActionsToConnectorActions` no longer escalates unknown `AddKey` permissions to `FullAccess`.** A permission that is neither `functionCall` nor `fullAccess` (a typo, or a future gas-key permission) now throws instead of silently minting a full-access key. Pass a `ConnectorAction` explicitly if you need an unusual permission.
- `SignedDelegate` actions inside a transaction now throw a clear error instead of being passed through; delegates are signed via `signDelegateActions`.
- Fix `deployGlobalContract` mapping: the `AccountId` deploy mode (which near-api-js stores as `null`) now maps correctly in all shapes, and the `enum` field is treated as authoritative so the inactive variant key no longer misclassifies the mode.
- `useGlobalContract` identifier mapping is null-safe (`AccountId: ""` no longer falls through to `codeHash`).
- New manifest feature `gasKeys` with a fail-closed host-side gate. Every wallet wrapper (sandbox, injected, parent-frame) refuses gas-key actions — `AddKey` with `gasKeyInfo`, `TransferToGasKey`, `WithdrawFromGasKey` — for wallets that do not advertise the feature (`assertGasKeyActionsSupported`, exported, along with `isGasKeyAction` and the `GasKeyInfo` type). A wallet that predates gas keys would at best reject the request, and at worst ignore the unknown `gasKeyInfo` field and add a *plain* key with the permission it does understand. No bundled wallet advertises `gasKeys` yet; flipping the flag per wallet requires a verified sign-and-send first.

# 0.11.5

- Fix opening wallet links from a Telegram Mini App: `window.open` from the sandbox is blocked there, so https links now go through Telegram (`openTelegramLink` / `openLink`), also when the dApp does not load `telegram-web-app.js`. The open request now always gets a response.
- Copy to clipboard from sandboxed wallets falls back to the dApp page (`clipboardWrite` permission) when the Clipboard API rejects inside the sandbox, e.g. in Android webviews.
- A failed IndexedDB write of the executor cache (iOS Safari "Connection to Indexed Database server lost", private mode) no longer stops the wallet from opening; an executor response with an HTTP error is not cached and run.

# 0.11.4

- Add `cspNonce` option to `NearConnector` for CSP compliance. When set, the nonce is added to both `<script>` tags inside the `srcdoc` sandbox iframe, allowing them to execute under nonce-based Content Security Policy.

# 0.11.3

- Export `EventMap`, `EventType`, and `Account` types from barrel

# 0.11.2

- The wallet manifest is now available inside the sandbox.
- Add metadata object to wallet manifest for any constants data

# 0.11.1

- Add bluetooth permission for sandbox

# 0.11.0

- Add feature **signInAndSignMessage**
- Add feature **signInWithFunctionCallKey**

# 0.10.0

- Add **signInAndSignMessage** method
- Fix footer branding bugs
- Remove default HOT Branding
- Make icon in branding optional

# 0.9.0

- Add connect.use(WalletPlugin): **Experimental** feature to override wallet methods
- Add footerBranding property to disable or override footer UI
- Add signDelegateAction

# 0.8.2

- Fix css styles

# 0.8.0

- Remove WalletConnect as optional dep
- Change types for UseGlobalContractAction and DeployGlobalContractAction

# 0.7.0

- Add UseGlobalContractAction, DeployGlobalContractAction
- Support Actions from @near-js

# 0.6.11

- Add `signIn` to setup limited access key (deprecated flow)

# 0.6.10

- Fix SSR issues
- Fix random class name

# 0.6.9

- Fix SSR issues
- Move styles to isolated className

# 0.6.8

- Add fallback for manifest
- Remove contractId and methods from signIn method

# 0.6.7

- Move all intents specific code and multichain connector to @hot-labs/wibe3
- remove connectWithKey option
- add excludeWallets, providers and isBannedNearAddress options
- some cache improvements

# 0.6.4

- Add Intents class and more exports

# 0.6.3

- Add autoConnect option for NearConnector (usable for ParentFrameWallets)

# 0.6.2

- Improve html templater, fix ui bugs

# 0.6.1

- Fix MultichainPopup ui bug

# 0.6.0

- add html templater and improve Popup lifecycle render flow
- add debug manifests
- improve styles

# 0.5.7

- fix returns types for `signAndSendTransactions` in `InjectedWallet`

# 0.5.6

- Add `HotConnector.disconnect(type, { silent: true })`
- Change `signIntentsWithAuth` for NearWallet, use accountId as signerId for intents
