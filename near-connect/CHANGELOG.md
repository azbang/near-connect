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
