"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectedWallet = void 0;
const actions_1 = require("./actions");
const resolveAuth_1 = require("./helpers/resolveAuth");
class InjectedWallet {
    connector;
    wallet;
    constructor(connector, wallet) {
        this.connector = connector;
        this.wallet = wallet;
    }
    get manifest() {
        return this.wallet.manifest;
    }
    async signIn({ addFunctionCallKey, network }) {
        return this.wallet.signIn({
            network: network ?? this.connector.network,
            addFunctionCallKey,
        });
    }
    async signInAndSignMessage(data) {
        const network = data?.network ?? this.connector.network;
        if (this.manifest.features?.signInAndSignMessage === true) {
            return this.wallet.signInAndSignMessage({
                network,
                addFunctionCallKey: data.addFunctionCallKey,
                messageParams: data.messageParams,
            });
        }
        return (0, resolveAuth_1.polyfillSignInAndSignMessage)(this, { ...data, network });
    }
    async signOut(data) {
        await this.wallet.signOut({ network: data?.network ?? this.connector.network });
    }
    async getAccounts(data) {
        return this.wallet.getAccounts({ network: data?.network ?? this.connector.network });
    }
    async signAndSendTransaction(params) {
        const actions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
        const network = params.network ?? this.connector.network;
        const result = await this.wallet.signAndSendTransaction({ ...params, actions, network });
        if (!result)
            throw new Error("No result from wallet");
        // @ts-ignore
        if (Array.isArray(result.transactions))
            return result.transactions[0];
        return result;
    }
    async signAndSendTransactions(params) {
        const network = params.network ?? this.connector.network;
        const transactions = params.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId,
        }));
        const result = await this.wallet.signAndSendTransactions({ ...params, transactions, network });
        if (!result)
            throw new Error("No result from wallet");
        // @ts-ignore
        if (Array.isArray(result.transactions))
            return result.transactions;
        return result;
    }
    async signMessage(params) {
        return this.wallet.signMessage({ ...params, network: params.network ?? this.connector.network });
    }
    async signDelegateActions(params) {
        return this.wallet.signDelegateActions({
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
                ...delegateAction,
                actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions),
            })),
            network: params.network ?? this.connector.network,
        });
    }
    async resolveAuth(params) {
        const args = { ...params, network: params.network ?? this.connector.network };
        if (this.manifest.features?.resolveAuth === true && this.wallet.resolveAuth) {
            try {
                return await this.wallet.resolveAuth(args);
            }
            catch (e) {
                // See SandboxedWallet.resolveAuth — fall through to the default
                // signMessage-based impl when the injected wallet reports the
                // method isn't implemented.
                if (!(0, resolveAuth_1.isResolveAuthMethodNotFound)(e))
                    throw e;
            }
        }
        return (0, resolveAuth_1.defaultResolveAuthViaSignMessage)(this, args);
    }
}
exports.InjectedWallet = InjectedWallet;
//# sourceMappingURL=InjectedWallet.js.map