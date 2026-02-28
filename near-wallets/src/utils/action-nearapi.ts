import { connectorActionsToNearActions } from "./action";

import type { ConnectorAction } from "./action";

/**
 * Kept for backwards compatibility with callers expecting a near-api-js style helper.
 * The output action format remains equivalent for downstream serializers.
 */
export const connectorActionsToNearApiJsActions = (actions: ConnectorAction[]): any[] => {
  return connectorActionsToNearActions(actions);
};
