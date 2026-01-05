import { FC, useMemo, useState } from "react";
import { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import SignClient from "@walletconnect/sign-client";

import { NetworkSelector } from "./form-component/NetworkSelector.tsx";
import { WalletActions } from "./WalletActions.tsx";

export const ExampleNEAR: FC = () => {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("mainnet");
  const [account, _setAccount] = useState<{ id: string; network: "testnet" | "mainnet" }>();
  const [wallet, setWallet] = useState<NearWalletBase | undefined>();

  const logger = {
    log: (args: any) => console.log(args),
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

    connector.on("wallet:signOut", async () => {
      setWallet(undefined);
      setAccount(undefined);
    });

    connector.wallet().then(async (wallet) => {
      wallet.getAccounts().then((t) => {
        setAccount(t[0]);
        setWallet(wallet);
      });
    });

    return connector;
  });

  const networkAccount = useMemo(() => (account != null && account.network === network ? account : undefined), [account, network]);

  const connect = async () => {
    if (networkAccount != null) return connector.disconnect();
    await connector.connect();
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
      <button className={"input-button"} onClick={() => connect()}>
        {networkAccount != null ? `${networkAccount.id} (logout)` : "Connect"}
      </button>

      {networkAccount != null && <WalletActions wallet={wallet!} network={network} />}
    </div>
  );
};
