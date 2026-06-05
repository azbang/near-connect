"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuid4 = void 0;
const uuid4 = () => {
    if (typeof window !== "undefined" && typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function")
        return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
exports.uuid4 = uuid4;
//# sourceMappingURL=uuid.js.map