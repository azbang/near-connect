"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxWallet = void 0;
const actions_1 = require("../actions");
const resolveAuth_1 = require("../helpers/resolveAuth");
const executor_1 = __importDefault(require("./executor"));
class SandboxWallet {
    connector;
    manifest;
    executor;
    constructor(connector, manifest) {
        this.connector = connector;
        this.manifest = manifest;
        this.executor = new executor_1.default(connector, manifest);
    }
    async signIn(data) {
        return this.executor.call("wallet:signIn", {
            network: data?.network ?? this.connector.network,
            addFunctionCallKey: data?.addFunctionCallKey,
        });
    }
    async signInAndSignMessage(data) {
        const network = data?.network ?? this.connector.network;
        if (this.manifest.features?.signInAndSignMessage === true) {
            return this.executor.call("wallet:signInAndSignMessage", {
                network,
                addFunctionCallKey: data?.addFunctionCallKey,
                messageParams: data.messageParams,
            });
        }
        return (0, resolveAuth_1.polyfillSignInAndSignMessage)(this, { ...data, network });
    }
    async signOut(data) {
        const args = { ...data, network: data?.network ?? this.connector.network };
        await this.executor.call("wallet:signOut", args);
        await this.executor.clearStorage();
    }
    async getAccounts(data) {
        const args = { ...data, network: data?.network ?? this.connector.network };
        return this.executor.call("wallet:getAccounts", args);
    }
    async signAndSendTransaction(params) {
        const actions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
        const args = { ...params, actions, network: params.network ?? this.connector.network };
        return this.executor.call("wallet:signAndSendTransaction", args);
    }
    async signAndSendTransactions(params) {
        const transactions = params.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId,
        }));
        const args = { ...params, transactions, network: params.network ?? this.connector.network };
        return this.executor.call("wallet:signAndSendTransactions", args);
    }
    async signMessage(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        return this.executor.call("wallet:signMessage", args);
    }
    async signDelegateActions(params) {
        const args = {
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
                ...delegateAction,
                actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions),
            })),
            network: params.network ?? this.connector.network,
        };
        return this.executor.call("wallet:signDelegateActions", args);
    }
    async resolveAuth(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        if (this.manifest.features?.resolveAuth === true) {
            try {
                return await this.executor.call("wallet:resolveAuth", args);
            }
            catch (e) {
                // Manifest may advertise `resolveAuth: true` for a wallet that hasn't
                // implemented it natively — that's the signal that the default
                // signMessage-based fallback is acceptable. Only swallow the specific
                // "method not found" signal; any other error is a real failure.
                if (!(0, resolveAuth_1.isResolveAuthMethodNotFound)(e))
                    throw e;
            }
        }
        return (0, resolveAuth_1.defaultResolveAuthViaSignMessage)(this, args);
    }
}
exports.SandboxWallet = SandboxWallet;
exports.default = SandboxWallet;
//# sourceMappingURL=index.js.map