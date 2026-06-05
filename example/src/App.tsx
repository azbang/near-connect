import { NearConnector, NearWalletBase, verifyResolveAuth } from "@hot-labs/near-connect";
import SignClient from "@walletconnect/sign-client";
import { FC, useMemo, useState } from "react";

import { KeyPairEd25519 } from "@near-js/crypto";
import { useLocalStorage } from "usehooks-ts";
import type { NearConnector_ConnectOptions } from "../../src/types/index.ts";
import { NetworkSelector } from "./form-component/NetworkSelector.tsx";
import { WalletActions } from "./WalletActions.tsx";
import { parseNearAmount } from "@near-js/utils";

const RPC_URL = "https://relmn.aurora.dev";

const ProveOwnershipDemo: FC<{
  connector: NearConnector;
  onAuthenticated: (wallet: NearWalletBase, accountId: string) => void;
}> = ({ connector, onAuthenticated }) => {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleProveOwnership = async () => {
    setStatus("");
    setError("");
    setLoading(true);
    try {
      // 1. Pick a wallet that supports resolveAuth — no signIn
      setStatus("Select wallet...");
      const walletId = await connector.selectWallet({
        features: { resolveAuth: true } as any,
      });
      const wallet = await connector.wallet(walletId);
      if (!wallet?.resolveAuth) {
        setError("Selected wallet does not support resolveAuth (NEP-641). Try Ethereum Wallet.");
        return;
      }

      // 2. Generate challenge and request authorization (single signature)
      setStatus("Sign authorization...");
      const challenge = `Login to Example App at ${new Date().toISOString()}`;
      const res = await wallet.resolveAuth({
        purpose: "PROVE_OWNERSHIP",
        recipient: "example.app",
        payload: challenge,
      });

      // 3. Verify per NEP-641 — w_resolve_auth pinned to a single block,
      // with NEP-413 fallback for regular accounts that don't implement it.
      setStatus(`Verifying for ${res.accountId}...`);
      const verification = await verifyResolveAuth({
        rpcUrl: RPC_URL,
        accountId: res.accountId,
        purpose: "PROVE_OWNERSHIP",
        recipient: "example.app",
        authorization: res.authorization,
      });

      if (verification.status !== "RESOLVED") {
        setError(`Verification failed: ${verification.errorMessage}`);
        return;
      }

      // 4. Verify payload matches the challenge we issued
      if (verification.payload !== challenge) {
        setError(`Payload mismatch: expected "${challenge}", got "${verification.payload}"`);
        return;
      }

      // 5. Authenticated — set the wallet and account
      setStatus(`Verified! Account: ${res.accountId}`);
      onAuthenticated(wallet, res.accountId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button className={"input-button"} disabled={loading} onClick={handleProveOwnership}>
        {loading ? status || "Proving..." : "Connect & Prove Ownership (NEP-641)"}
      </button>
      {error && <p style={{ color: "#ff6b6b", fontSize: "0.75rem", marginTop: 4 }}>{error}</p>}
    </div>
  );
};

export const ExampleNEAR: FC = () => {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("mainnet");
  const [account, _setAccount] = useState<{ id: string; network: "testnet" | "mainnet" }>();
  const [wallet, setWallet] = useState<NearWalletBase | undefined>();
  const [extendedSecretKey, setExtendedSecretKey] = useLocalStorage<string | undefined>(`example-extended-secret-key-${network}`, undefined);

  const logger = {
    log: (...args: any[]) => console.log(args),
  };

  function setAccount(account: { accountId: string } | undefined) {
    if (account == null) return _setAccount(undefined);
    _setAccount({ id: account.accountId, network: account.accountId.endsWith("testnet") ? "testnet" : "mainnet" });
  }

  const [connector] = useState<NearConnector>(() => {
    const walletConnect = SignClient.init({
      projectId: "16ebac7c9fbe9e612bb78ea9f012ce80",
      metadata: {
        name: "Example App",
        description: "Example App",
        url: "https://example.com",
        icons: ["/favicon.ico"],
      },
    });

    const connector = new NearConnector({
      manifest: process.env.NODE_ENV === "production" ? undefined : "/near-connect/repository/manifest.json",
      providers: { mainnet: ["https://relmn.aurora.dev"] },
      walletConnect,
      network,
      logger,
    });

    connector.on("wallet:signIn", async (t) => {
      setWallet(await connector.wallet());
      setAccount(t.accounts[0]);
    });

    connector.on("wallet:signInAndSignMessage", async (t) => {
      logger.log(`[wallet:signInAndSignMessage] Signed in to wallet accounts (with signed messages)`, t.accounts);
    });

    connector.on("wallet:signOut", async () => {
      setWallet(undefined);
      setAccount(undefined);
    });

    // commented out this code as it will cause race-condition with autoConnect
    // and setting the account/wallet incorrectly
    // connector.wallet().then(async (wallet) => {
    //   wallet.getAccounts().then((t) => {
    //     setAccount(t[0]);
    //     setWallet(wallet);
    //   });
    // });

    return connector;
  });

  const networkAccount = useMemo(() => (account != null && account.network === network ? account : undefined), [account, network]);

  const connect = async (options: NearConnector_ConnectOptions = {}) => {
    if (networkAccount != null) return connector.disconnect();
    await connector.connect(options);
  };

  return (
    <div className="view">
      <p>NEAR Example</p>
      <NetworkSelector
        network={network}
        onSelectNetwork={(network) => {
          setNetwork(network);
          connector.switchNetwork(network);
        }}
      />
      <button
        className={"input-button"}
        onClick={() => {
          connect();
        }}
      >
        {networkAccount != null ? `${networkAccount.id} (logout)` : "Connect"}
      </button>
      {networkAccount == null && (
        <>
          <button
            className={"input-button"}
            onClick={() => {
              const nonce = new Uint8Array(window.crypto.getRandomValues(new Uint8Array(32)));
              connect({ signMessageParams: { message: "Sign in to Example App", recipient: "Demo app", nonce } });
            }}
          >
            Connect (With Signed Message)
          </button>
          <button
            className={"input-button"}
            onClick={() => {
              const key = KeyPairEd25519.fromRandom();
              const extendedSecretKey = key.toString();
              const publicKey = key.publicKey.toString();

              setExtendedSecretKey(extendedSecretKey);

              connect({
                addFunctionCallKey: {
                  publicKey: publicKey,
                  contractId: network === "mainnet" ? "social.near" : "v1.social08.testnet",
                  allowMethods: {
                    anyMethod: false,
                    methodNames: ["get", "set"],
                  },
                  gasAllowance: {
                    kind: "limited",
                    amount: parseNearAmount("0.5")!, // 0.5 NEAR in yoctoNEAR
                  },
                },
              });
            }}
          >
            Connect (With Add Key)
          </button>
          <ProveOwnershipDemo
            connector={connector}
            onAuthenticated={(w, acctId) => {
              setWallet(w);
              setAccount({ accountId: acctId });
            }}
          />
        </>
      )}

      {networkAccount != null && <WalletActions extendedSecretKey={extendedSecretKey} wallet={wallet!} network={network} />}
    </div>
  );
};
