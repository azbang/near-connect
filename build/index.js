"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResolveAuth = exports.nearActionsToConnectorActions = exports.NearConnector = exports.InjectedWallet = exports.SandboxWallet = exports.ParentFrameWallet = exports.LocalStorage = void 0;
var storage_1 = require("./helpers/storage");
Object.defineProperty(exports, "LocalStorage", { enumerable: true, get: function () { return storage_1.LocalStorage; } });
var ParentFrameWallet_1 = require("./ParentFrameWallet");
Object.defineProperty(exports, "ParentFrameWallet", { enumerable: true, get: function () { return ParentFrameWallet_1.ParentFrameWallet; } });
var SandboxedWallet_1 = require("./SandboxedWallet");
Object.defineProperty(exports, "SandboxWallet", { enumerable: true, get: function () { return SandboxedWallet_1.SandboxWallet; } });
var InjectedWallet_1 = require("./InjectedWallet");
Object.defineProperty(exports, "InjectedWallet", { enumerable: true, get: function () { return InjectedWallet_1.InjectedWallet; } });
var NearConnector_1 = require("./NearConnector");
Object.defineProperty(exports, "NearConnector", { enumerable: true, get: function () { return NearConnector_1.NearConnector; } });
var actions_1 = require("./actions");
Object.defineProperty(exports, "nearActionsToConnectorActions", { enumerable: true, get: function () { return actions_1.nearActionsToConnectorActions; } });
var verifyResolveAuth_1 = require("./helpers/verifyResolveAuth");
Object.defineProperty(exports, "verifyResolveAuth", { enumerable: true, get: function () { return verifyResolveAuth_1.verifyResolveAuth; } });
//# sourceMappingURL=index.js.map