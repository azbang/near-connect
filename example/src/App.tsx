import { FC, useMemo, useState } from "react";
import { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import SignClient from "@walletconnect/sign-client";

import { NetworkSelector } from "./form-component/NetworkSelector.tsx";
import { WalletActions } from "./WalletActions.tsx";
import type { NearConnector_ConnectOptions } from "../../src/types/index.ts";

export const ExampleNEAR: FC = () => {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("mainnet");
  const [account, _setAccount] = useState<{ id: string; network: "testnet" | "mainnet" }>();
  const [wallet, setWallet] = useState<NearWalletBase | undefined>();

  const logger = {
    log: (...args: any[]) => console.log(args),
  };

  function setAccount(account: { accountId: string } | undefined) {
    if (account == null) return _setAccount(undefined);
    _setAccount({ id: account.accountId, network: account.accountId.endsWith("testnet") ? "testnet" : "mainnet" });
  }

  const [connector] = useState<NearConnector>(() => {
    const walletConnect = SignClient.init({
      projectId: "1292473190ce7eb75c9de67e15aaad99",
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
      <button className={"input-button"} onClick={() => { connector.signInData = undefined; connect(); }}>
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
              connector.signInData = { contractId: "social.near", methodNames: ["set"] };
              connect();
            }}
          >
            Connect (With Add Key)
          </button>
        </>
      )}

      {networkAccount != null && <WalletActions wallet={wallet!} network={network} />}
    </div>
  );
};
