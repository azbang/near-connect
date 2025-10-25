import { FC, useState } from "react";

import { HotConnector, Intents, WalletType } from "@hot-labs/wibe3";
import { NearConnector, NearWalletBase } from "../../near-connect/src";

import { NetworkSelector } from "./form-component/NetworkSelector.tsx";
import { WalletActions } from "./WalletActions.tsx";

export const ExampleNEAR: FC = () => {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("mainnet");
  const [account, _setAccount] = useState<{ id: string; network: "testnet" | "mainnet" }>();
  const [wallet, setWallet] = useState<NearWalletBase | undefined>();

  function setAccount(account: { accountId: string } | undefined) {
    if (account == null) return _setAccount(undefined);
    _setAccount({ id: account.accountId, network: account.accountId.endsWith("testnet") ? "testnet" : "mainnet" });
  }

  const [connector] = useState<NearConnector>(() => {
    const connector = new NearConnector({
      manifest: "/hot-connector/manifest.json",
      providers: { mainnet: ["https://relmn.aurora.dev"] },
      network,

      walletConnect: {
        projectId: "1292473190ce7eb75c9de67e15aaad99",
        metadata: {
          name: "Example App",
          description: "Example App",
          url: "https://example.com",
          icons: ["/favicon.ico"],
        },
      },
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

  const networkAccount = account != null && account.network === network ? account : undefined;
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

export const MultichainExample = () => {
  const [wallets, setWallets] = useState<Record<WalletType, string | null>>({
    [WalletType.NEAR]: null,
    [WalletType.EVM]: null,
    [WalletType.SOLANA]: null,
    [WalletType.TON]: null,
    [WalletType.STELLAR]: null,
    [WalletType.PASSKEY]: null,
  });

  const [connector] = useState<HotConnector>(() => {
    const connector = new HotConnector();
    connector.onConnect(async ({ wallet }) => {
      if (!wallet) return;
      const address = await wallet.getAddress();
      setWallets((t) => ({ ...t, [wallet.type]: address }));
    });

    connector.onDisconnect(({ wallet }) => {
      if (!wallet) return;
      setWallets((t) => ({ ...t, [wallet.type]: null }));
    });

    return connector;
  });

  return (
    <div className="view">
      <p>Multichain Example</p>

      <button className={"input-button"} onClick={() => connector.connect()}>
        Open connector
      </button>

      {Object.entries(wallets).map(
        ([type, address]) =>
          address != null && (
            <div key={type} style={{ width: 200 }}>
              <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</p>
              <button
                className={"input-button"}
                onClick={async () => {
                  try {
                    const wallet = connector.wallets.find((t) => t.type === +type);
                    if (!wallet) return;
                    const { signed } = await wallet.auth("auth", [], async (t) => t);
                    const result = await Intents.simulateIntents([signed]);
                    console.log(result);
                    alert("Verified!");
                  } catch (e) {
                    console.error(e);
                    alert("Something wrong, check DevTools");
                  }
                }}
              >
                Sign auth intents
              </button>
            </div>
          )
      )}
    </div>
  );
};
