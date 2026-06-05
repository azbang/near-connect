"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUrl = void 0;
const parseUrl = (url) => {
    try {
        return new URL(url);
    }
    catch {
        return null;
    }
};
exports.parseUrl = parseUrl;
//# sourceMappingURL=url.js.map