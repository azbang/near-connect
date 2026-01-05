import type { Signer } from "@near-js/signers";
import { JsonRpcProvider } from "@near-js/providers";
import type { AccessKeyViewRaw, FinalExecutionOutcome } from "@near-js/types";
import type { Transaction as NearTransaction } from "@near-js/transactions";
import { createTransaction } from "@near-js/transactions";
import { baseDecode } from "@near-js/utils";
import { PublicKey } from "@near-js/crypto";

import { ConnectorAction, connectorActionsToNearActions } from "../utils/action";

export const createTransactions = async (
  transactions: { signerId: string; receiverId: string; actions: ConnectorAction[] }[],
  signer: Signer,
  network: { networkId: string; nodeUrl: string }
): Promise<NearTransaction[]> => {
  const nearTransactions: NearTransaction[] = [];
  const provider = new JsonRpcProvider({ url: network.nodeUrl });

  for (let i = 0; i < transactions.length; i++) {
    const publicKey = await signer.getPublicKey(transactions[i].signerId, network.networkId);

    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<AccessKeyViewRaw>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transactions[i].signerId,
        public_key: publicKey.toString(),
      }),
    ]);

    const transaction = createTransaction(
      transactions[i].signerId,
      PublicKey.from(publicKey.toString()),
      transactions[i].receiverId,
      accessKey.nonce + i + 1,
      connectorActionsToNearActions(transactions[i].actions),
      baseDecode(block.header.hash)
    );

    nearTransactions.push(transaction);
  }
  return nearTransactions;
};

export const signAndSendTransactionsHandler = async (
  transactions: { signerId: string; receiverId: string; actions: ConnectorAction[] }[],
  signer: Signer,
  network: { networkId: string; nodeUrl: string }
): Promise<Array<FinalExecutionOutcome>> => {
  const nearTxs = await createTransactions(transactions, signer, network);
  const results: Array<FinalExecutionOutcome> = [];
  for (const tx of nearTxs) {
    const result = await window.selector.external("nightly.near", "signTransaction", tx.encode(), true);
    results.push(result);
  }
  return results;
};
