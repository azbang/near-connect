import { OATH_METHODS, sessionAccounts, type Session } from "./connector";
import type { Network } from "../utils/types";

export interface PairingBridge {
  connect(params: unknown): Promise<{ uri?: string }>;
  getSession(params: { pairingTopic: string }): Promise<Session | null>;
}
export interface PairingView {
  open(uri: string): Promise<void>;
  onClose(callback: () => void): () => void;
  close(): void;
}
export async function pairOath(bridge: PairingBridge, view: PairingView, network: Network,
  timeoutMs = 300_000, intervalMs = 500): Promise<Session> {
  const result = await bridge.connect({ requiredNamespaces: { near: { chains: [`near:${network}`], methods: OATH_METHODS, events: [] } } });
  if (!result.uri?.startsWith("wc:")) throw new Error("No WalletConnect pairing URI");
  const pairingTopic = result.uri.slice(3).split("@")[0];
  let cancelled = false;
  let unsubscribe = () => {};
  try {
    await view.open(result.uri);
    unsubscribe = view.onClose(() => { cancelled = true; });
    const deadline = Date.now() + timeoutMs;
    while (!cancelled && Date.now() < deadline) {
      const current = await bridge.getSession({ pairingTopic });
      if (cancelled) break;
      if (current?.pairingTopic === pairingTopic && sessionAccounts(current, network).length) return current;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(cancelled ? "User cancelled Oath pairing" : "Oath pairing expired; please try again");
  } finally {
    unsubscribe();
    view.close();
  }
}
