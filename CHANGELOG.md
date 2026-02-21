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
