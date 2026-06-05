"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentFrameWallet = void 0;
const actions_1 = require("./actions");
const resolveAuth_1 = require("./helpers/resolveAuth");
const uuid_1 = require("./helpers/uuid");
class ParentFrameWallet {
    connector;
    manifest;
    constructor(connector, manifest) {
        this.connector = connector;
        this.manifest = manifest;
    }
    callParentFrame(method, params) {
        const id = (0, uuid_1.uuid4)();
        window.parent.postMessage({ type: "near-wallet-injected-request", id, method, params }, "*");
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                if (event.data.type === "near-wallet-injected-response" && event.data.id === id) {
                    window.removeEventListener("message", handler);
                    if (event.data.success)
                        resolve(event.data.result);
                    else
                        reject(event.data.error);
                }
            };
            window.addEventListener("message", handler);
        });
    }
    async signIn(data) {
        const result = await this.callParentFrame("near:signIn", {
            network: data?.network ?? this.connector.network,
            addFunctionCallKey: data?.addFunctionCallKey,
        });
        if (Array.isArray(result))
            return result;
        return [result];
    }
    async signInAndSignMessage(data) {
        const network = data?.network ?? this.connector.network;
        if (this.manifest.features?.signInAndSignMessage === true) {
            const result = await this.callParentFrame("near:signInAndSignMessage", {
                network,
                addFunctionCallKey: data?.addFunctionCallKey,
                messageParams: data.messageParams,
            });
            if (Array.isArray(result))
                return result;
            return [result];
        }
        return (0, resolveAuth_1.polyfillSignInAndSignMessage)(this, { ...data, network });
    }
    async signOut(data) {
        const args = { ...data, network: data?.network ?? this.connector.network };
        await this.callParentFrame("near:signOut", args);
    }
    async getAccounts(data) {
        const args = { ...data, network: data?.network ?? this.connector.network };
        return this.callParentFrame("near:getAccounts", args);
    }
    async signAndSendTransaction(params) {
        const connectorActions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
        const args = { ...params, actions: connectorActions, network: params.network ?? this.connector.network };
        return this.callParentFrame("near:signAndSendTransaction", args);
    }
    async signAndSendTransactions(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        args.transactions = args.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId,
        }));
        return this.callParentFrame("near:signAndSendTransactions", args);
    }
    async signMessage(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        return this.callParentFrame("near:signMessage", args);
    }
    async signDelegateActions(params) {
        const args = {
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
                ...delegateAction,
                actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions),
            })),
            network: params.network || this.connector.network,
        };
        return this.callParentFrame("near:signDelegateActions", args);
    }
    async resolveAuth(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        if (this.manifest.features?.resolveAuth === true) {
            try {
                return (await this.callParentFrame("near:resolveAuth", args));
            }
            catch (e) {
                // See SandboxedWallet.resolveAuth — fall through to the default
                // signMessage-based impl when the parent frame reports the method
                // isn't implemented.
                if (!(0, resolveAuth_1.isResolveAuthMethodNotFound)(e))
                    throw e;
            }
        }
        return (0, resolveAuth_1.defaultResolveAuthViaSignMessage)(this, args);
    }
}
exports.ParentFrameWallet = ParentFrameWallet;
//# sourceMappingURL=ParentFrameWallet.js.map