"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.html = html;
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
const htmlTag = Symbol("htmlTag");
function html(strings, ...values) {
    let result = strings[0];
    for (let i = 0; i < values.length; i++) {
        for (const value of Array.isArray(values[i]) ? values[i] : [values[i]]) {
            const escaped = value?.[htmlTag] ? value[htmlTag] : escapeHtml(String(value ?? ""));
            result += escaped;
        }
        result += strings[i + 1];
    }
    return Object.freeze({
        [htmlTag]: result,
        get html() {
            return result;
        },
    });
}
//# sourceMappingURL=html.js.map