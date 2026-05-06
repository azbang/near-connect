# @hot-labs/near-connect — Skill Spec

Zero-dependency wallet connector for the NEAR blockchain. Runs wallet code in sandboxed iframes for security, auto-updates wallets via a remote manifest, and supports browser extensions, mobile wallets via WalletConnect, and injected wallets.

## Domains

| Domain | Description | Skills |
| ------ | ----------- | ------ |
| connecting | Initializing connector, connecting/disconnecting wallets, events, feature filtering, WalletConnect | near-connect-quickstart |
| transacting | Action formats, signing transactions and messages, delegate actions, function call keys | near-connect-transactions |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| ------ | ---- | ------ | -------------- | ------------- |
| near-connect-quickstart | lifecycle | connecting | NearConnector init, connect/disconnect, events, features, WalletConnect, manifest | 6 |
| near-connect-transactions | core | transacting | ConnectorAction format, signAndSendTransaction, signMessage, signInAndSignMessage, delegate actions, access keys | 5 |

## Failure Mode Inventory

### near-connect-quickstart (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|-------------|
| 1 | Using near-wallet-selector API instead of near-connect | CRITICAL | Repository comparison | — |
| 2 | Not awaiting manifest loading before calling connect | HIGH | src/NearConnector.ts:89-137 | — |
| 3 | Omitting WalletConnect config causes wallets to silently disappear | HIGH | src/NearConnector.ts:128-133 | — |
| 4 | Using library in SSR without guarding browser APIs | HIGH | src/NearConnector.ts:139-155; CHANGELOG | — |
| 5 | Using deprecated signIn constructor option | MEDIUM | src/NearConnector.ts:46-52 | — |
| 6 | Not listening for signOut to detect wallet disconnection | MEDIUM | src/types/index.ts:212-218 | — |

### near-connect-transactions (5 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|-------------|
| 1 | Using near-api-js action format when ConnectorAction is recommended | MEDIUM | src/actions/types.ts | — |
| 2 | Omitting gas and deposit in FunctionCall action | HIGH | src/actions/types.ts:10-18 | — |
| 3 | Calling signMessage without required nonce | HIGH | src/types/index.ts:81-87 | — |
| 4 | Confusing signMessage with signInAndSignMessage | HIGH | src/NearConnector.ts:297-316 | — |
| 5 | Wrong gas allowance units for function call keys | MEDIUM | src/NearConnector.ts:290-293 | — |

## Tensions

| Tension | Skills | Agent implication |
| ------- | ------ | ----------------- |
| Quick setup vs WalletConnect complexity | near-connect-quickstart | Agents create minimal setups that work on desktop but silently lose mobile wallets |

## Cross-References

| From | To | Reason |
| ---- | -- | ------ |
| near-connect-quickstart | near-connect-transactions | After connecting, the next step is always signing or transacting |

## Remaining Gaps

None — all gaps resolved during lightweight interview.

## Recommended Skill File Structure

- **Lifecycle skills:** near-connect-quickstart
- **Core skills:** near-connect-transactions
- **Framework skills:** None (framework-agnostic library)
- **Composition skills:** None
- **Reference files:** None needed (compact API surface)

## Composition Opportunities

No composition skills needed — this library is standalone with no peer dependencies.
