"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Popup = void 0;
const styles_1 = require("./styles");
const html_1 = require("../helpers/html");
const ID = `n${Math.random().toString(36).substring(2, 15)}`;
if (typeof document !== "undefined") {
    const style = document.createElement("style");
    style.textContent = (0, styles_1.css)(`.${ID}`);
    document.head.append(style);
}
class Popup {
    delegate;
    isClosed = false;
    root = document.createElement("div");
    state = {};
    constructor(delegate) {
        this.delegate = delegate;
    }
    get dom() {
        return (0, html_1.html) ``;
    }
    disposables = [];
    addListener(querySelector, event, callback) {
        const element = typeof querySelector === "string" ? this.root.querySelector(querySelector) : querySelector;
        if (!element)
            return;
        element.addEventListener(event, callback);
        this.disposables.push(() => element.removeEventListener(event, callback));
    }
    handlers() {
        this.disposables.forEach((dispose) => dispose());
        this.disposables = [];
        const modalContainer = this.root.querySelector(".modal-container");
        const modalContent = this.root.querySelector(".modal-content");
        modalContent.onclick = (e) => e.stopPropagation();
        modalContainer.onclick = () => {
            this.delegate.onReject();
            this.destroy();
        };
    }
    update(state) {
        this.state = { ...this.state, ...state };
        this.root.innerHTML = this.dom.html;
        this.handlers();
    }
    create({ show = true }) {
        this.root.className = `${ID} hot-connector-popup`;
        this.root.innerHTML = this.dom.html;
        document.body.append(this.root);
        this.handlers();
        const modalContainer = this.root.querySelector(".modal-container");
        const modalContent = this.root.querySelector(".modal-content");
        modalContent.style.transform = "translateY(50px)";
        modalContainer.style.opacity = "0";
        this.root.style.display = "none";
        if (show) {
            setTimeout(() => this.show(), 10);
        }
    }
    show() {
        const modalContainer = this.root.querySelector(".modal-container");
        const modalContent = this.root.querySelector(".modal-content");
        modalContent.style.transform = "translateY(50px)";
        modalContainer.style.opacity = "0";
        this.root.style.display = "block";
        setTimeout(() => {
            modalContent.style.transform = "translateY(0)";
            modalContainer.style.opacity = "1";
        }, 100);
    }
    hide() {
        const modalContainer = this.root.querySelector(".modal-container");
        const modalContent = this.root.querySelector(".modal-content");
        modalContent.style.transform = "translateY(50px)";
        modalContainer.style.opacity = "0";
        setTimeout(() => {
            this.root.style.display = "none";
        }, 200);
    }
    destroy() {
        if (this.isClosed)
            return;
        this.isClosed = true;
        this.hide();
        setTimeout(() => {
            this.root.remove();
        }, 200);
    }
}
exports.Popup = Popup;
//# sourceMappingURL=Popup.js.map