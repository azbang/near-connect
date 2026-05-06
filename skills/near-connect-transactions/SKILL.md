---
name: near-connect-transactions
description: >
  Send transactions and sign messages with @hot-labs/near-connect. Covers
  ConnectorAction format (FunctionCall, Transfer, etc.), @near-js Action
  compatibility, signAndSendTransaction, signAndSendTransactions,
  signMessage, signInAndSignMessage, signDelegateActions, and function call
  access key parameters. Use when a dapp needs to call a NEAR contract,
  sign a message for authentication, or add a limited-access key.
type: core
library: near-connect
library_version: "0.11.3"
requires:
  - near-connect-quickstart
sources:
  - "hot-dao/near-selector:src/actions/types.ts"
  - "hot-dao/near-selector:src/actions/index.ts"
  - "hot-dao/near-selector:src/types/index.ts"
  - "hot-dao/near-selector:src/SandboxedWallet/index.ts"
---

This skill builds on near-connect-quickstart. Read it first for wallet connection setup.

# NEAR Connect — Transactions & Signing

## Setup

Get a connected wallet instance (requires sign-in first):

```typescript
import { NearConnector } from "@hot-labs/near-connect";

const connector = new NearConnector({ network: "mainnet" });
await connector.whenManifestLoaded;
await connector.connect();
const wallet = await connector.wallet();
```

## Core Patterns

### Send a single transaction (FunctionCall)

```typescript
const result = await wallet.signAndSendTransaction({
  receiverId: "contract.near",
  actions: [
    {
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer",
        args: { receiver_id: "bob.near", amount: "1000000000000000000000000" },
        gas: "30000000000000",
        deposit: "1",
      },
    },
  ],
});

console.log("Transaction hash:", result.transaction.hash);
```

### Send multiple transactions in batch

```typescript
const results = await wallet.signAndSendTransactions({
  transactions: [
    { receiverId: "token.near", actions: [{ type: "FunctionCall", params: { methodName: "ft_transfer", args: {}, gas: "30000000000000", deposit: "1" } }] },
    { receiverId: "nft.near", actions: [{ type: "FunctionCall", params: { methodName: "nft_transfer", args: {}, gas: "30000000000000", deposit: "1" } }] },
  ],
});
```

### Sign a message for authentication

```typescript
const nonce = crypto.getRandomValues(new Uint8Array(32));

const signed = await wallet.signMessage({
  message: "Sign in to My App",
  recipient: "My App",
  nonce,
});

console.log("Signed by:", signed.accountId, "signature:", signed.signature);
```

### Sign delegate actions (meta-transactions)

```typescript
const response = await wallet.signDelegateActions({
  delegateActions: [
    {
      receiverId: "contract.near",
      actions: [
        { type: "FunctionCall", params: { methodName: "method", args: {}, gas: "30000000000000", deposit: "0" } },
      ],
    },
  ],
});
```

### Add a function call access key during sign-in

```typescript
await connector.connect({
  addFunctionCallKey: {
    contractId: "game.near",
    publicKey: "ed25519:4rMHtoFKUoR rageZMwYpGDdGZpWn1eZ3JYaQY8jpRkPLBqoHvBZq",
    allowMethods: { anyMethod: false, methodNames: ["play", "claim"] },
    gasAllowance: { kind: "limited", amount: "250000000000000000000000" },
  },
});
```

Gas allowance defaults to 0.25 NEAR (in yoctoNEAR) with `kind: "limited"`. Use `kind: "unlimited"` for no limit.

## Action Format Reference

The library accepts two action formats in `signAndSendTransaction` and `signAndSendTransactions`:

**ConnectorAction (recommended):**

| Type | Required params |
| ---- | --------------- |
| `FunctionCall` | `methodName`, `args`, `gas` (yoctogas string), `deposit` (yoctoNEAR string) |
| `Transfer` | `deposit` (yoctoNEAR string) |
| `CreateAccount` | none |
| `DeployContract` | `code` (Uint8Array) |
| `DeleteAccount` | `beneficiaryId` (string) |
| `AddKey` | `publicKey`, `accessKey` |
| `DeleteKey` | `publicKey` |
| `Stake` | `stake`, `publicKey` |
| `DeployGlobalContract` | `code`, `deployMode` (`"CodeHash"` or `"AccountId"`) |
| `UseGlobalContract` | `contractIdentifier` (`{ accountId }` or `{ codeHash }`) |

**@near-js Action (also accepted):**

Actions from `@near-js/transactions` (e.g. `action.functionCall`) are automatically converted via `nearActionsToConnectorActions`. Both formats work, but ConnectorAction is recommended for portability.

## Common Mistakes

### HIGH Omitting gas and deposit in FunctionCall action

Wrong:

```typescript
actions: [{ type: "FunctionCall", params: { methodName: "ft_transfer", args: { receiver_id: "bob.near" } } }]
```

Correct:

```typescript
actions: [{ type: "FunctionCall", params: { methodName: "ft_transfer", args: { receiver_id: "bob.near", amount: "1000000000000000000000000" }, gas: "30000000000000", deposit: "1" } }]
```

FunctionCall requires `gas` (in yoctogas, e.g. `"30000000000000"` for 30 TGas) and `deposit` (in yoctoNEAR, e.g. `"1"` for 1 yoctoNEAR). Omitting them causes protocol-level transaction failure.

Source: src/actions/types.ts:10-18

### HIGH Calling signMessage without required nonce

Wrong:

```typescript
await wallet.signMessage({ message: "Sign in", recipient: "My App" });
```

Correct:

```typescript
const nonce = crypto.getRandomValues(new Uint8Array(32));
await wallet.signMessage({ message: "Sign in", recipient: "My App", nonce });
```

`signMessage` requires a `nonce` as `Uint8Array`. Omitting it causes the wallet to reject the request.

Source: src/types/index.ts:81-87

### HIGH Confusing signMessage with signInAndSignMessage

Wrong:

```typescript
await connector.connect({ walletId: "hot-wallet" });
const wallet = await connector.wallet();
const nonce = crypto.getRandomValues(new Uint8Array(32));
const signed = await wallet.signMessage({ message: "Sign in", recipient: "My App", nonce });
```

Correct:

```typescript
const nonce = crypto.getRandomValues(new Uint8Array(32));
await connector.connect({
  walletId: "hot-wallet",
  signMessageParams: { message: "Sign in", recipient: "My App", nonce },
});
```

`signMessage` is a standalone call after sign-in requiring two wallet interactions. `signInAndSignMessage` (triggered via `connect({ signMessageParams })`) combines both in one interaction. Use the latter for sign-in with ownership verification.

Source: src/NearConnector.ts:297-316

### MEDIUM Using near-api-js action format when ConnectorAction is recommended

Wrong:

```typescript
import { transactions } from "near-api-js";
await wallet.signAndSendTransaction({
  receiverId: "contract.near",
  actions: [transactions.functionCall("method", args, "30000000000000", "1")]
});
```

Correct:

```typescript
await wallet.signAndSendTransaction({
  receiverId: "contract.near",
  actions: [{ type: "FunctionCall", params: { methodName: "method", args: {}, gas: "30000000000000", deposit: "1" } }]
});
```

The library accepts both formats, but ConnectorAction is recommended. It's more portable across wallet types and avoids dependency on near-api-js serialization.

Source: src/actions/types.ts

### MEDIUM Wrong gas allowance units for function call keys

Wrong:

```typescript
addFunctionCallKey: { contractId: "game.near", publicKey: "ed25519:...", allowMethods: { anyMethod: false, methodNames: ["play"] }, gasAllowance: { kind: "limited", amount: "0.25" } }
```

Correct:

```typescript
addFunctionCallKey: { contractId: "game.near", publicKey: "ed25519:...", allowMethods: { anyMethod: false, methodNames: ["play"] }, gasAllowance: { kind: "limited", amount: "250000000000000000000000" } }
```

`gasAllowance.amount` is in yoctoNEAR. 0.25 NEAR = `250000000000000000000000` yoctoNEAR. Passing a human-readable number creates a key with insufficient or excessive allowance.

Source: src/NearConnector.ts:290-293

## Version

Targets @hot-labs/near-connect v0.11.3.
