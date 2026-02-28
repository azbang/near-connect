import { serialize as borshSerialize } from "borsh";
import { mapTransaction, SCHEMA } from "@fastnear/utils";
import type { PlainTransaction } from "@fastnear/utils";
import { NearRpc } from "../utils/rpc";
import { connectorActionsToFastnearActions } from "../utils/action";
import type { ConnectorAction } from "../utils/action";

export const signAndSendTransactionsHandler = async (
  transactions: { signerId: string; receiverId: string; actions: ConnectorAction[] }[],
  publicKey: string,
  network: { networkId: string; nodeUrl: string }
): Promise<Array<any>> => {
  const provider = new NearRpc([network.nodeUrl]);
  const results: Array<any> = [];

  for (let i = 0; i < transactions.length; i++) {
    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<any>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transactions[i].signerId,
        public_key: publicKey,
      }),
    ]);

    const plainTx: PlainTransaction = {
      signerId: transactions[i].signerId,
      publicKey,
      receiverId: transactions[i].receiverId,
      nonce: accessKey.nonce + i + 1,
      blockHash: block.header.hash,
      actions: connectorActionsToFastnearActions(transactions[i].actions),
    };

    const encodedTx = new Uint8Array(
      borshSerialize(SCHEMA.Transaction, mapTransaction(plainTx))
    );
    const result = await window.selector.external(
      "nightly.near", "signTransaction", encodedTx, true
    );
    results.push(result);
  }

  return results;
};
