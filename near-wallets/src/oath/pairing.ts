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
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await view.open(result.uri);
    let stop!: (error: Error) => void;
    const stopped = new Promise<never>((_, reject) => { stop = reject; });
    // A close notification can arrive synchronously while subscribing.
    void stopped.catch(() => {});
    deadlineTimer = setTimeout(() => stop(new Error("Oath pairing expired; please try again")), timeoutMs);
    unsubscribe = view.onClose(() => {
      cancelled = true;
      stop(new Error("User cancelled Oath pairing"));
    });
    while (true) {
      const current = await Promise.race([bridge.getSession({ pairingTopic }), stopped]);
      if (cancelled) throw new Error("User cancelled Oath pairing");
      if (current?.pairingTopic === pairingTopic && sessionAccounts(current, network).length) return current;
      await Promise.race([new Promise<void>(resolve => { pollTimer = setTimeout(resolve, intervalMs); }), stopped]);
    }
  } finally {
    clearTimeout(deadlineTimer);
    clearTimeout(pollTimer);
    unsubscribe();
    view.close();
  }
}
