"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
class LocalStorage {
    async get(key) {
        if (typeof window === "undefined")
            return null;
        return localStorage.getItem(key);
    }
    async set(key, value) {
        if (typeof window === "undefined")
            return;
        localStorage.setItem(key, value);
    }
    async remove(key) {
        if (typeof window === "undefined")
            return;
        localStorage.removeItem(key);
    }
}
exports.LocalStorage = LocalStorage;
//# sourceMappingURL=storage.js.map