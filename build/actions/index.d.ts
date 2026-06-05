import type { Action } from "@near-js/transactions";
import { ConnectorAction } from "./types";
export declare const nearActionsToConnectorActions: (actions: (Action | ConnectorAction)[]) => ConnectorAction[];
