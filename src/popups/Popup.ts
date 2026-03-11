import { css } from "./styles";
import { html } from "../helpers/html";

const ID = `n${Math.random().toString(36).substring(2, 15)}`;

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = css(`.${ID}`);
  document.head.append(style);
}

export class Popup<T extends Record<string, any>> {
  isClosed = false;
  root = document.createElement("div");
  state: T = {} as T;

  constructor(readonly delegate: { onReject: () => void }) {}

  get dom() {
    return html``;
  }

  disposables: (() => void)[] = [];
  addListener(querySelector: string | Element, event: string, callback: (e: Event) => void) {
    const element = typeof querySelector === "string" ? this.root.querySelector(querySelector)! : querySelector;
    if (!element) return;
    element.addEventListener(event, callback);
    this.disposables.push(() => element.removeEventListener(event, callback));
  }

  handlers() {
    this.disposables.forEach((dispose) => dispose());
    this.disposables = [];

    const modalContainer = this.root.querySelector(".modal-container")! as HTMLElement;
    const modalContent = this.root.querySelector(".modal-content")! as HTMLElement;
    modalContent.onclick = (e) => e.stopPropagation();
    modalContainer.onclick = () => {
      this.delegate.onReject();
      this.destroy();
    };
  }

  update(state: Partial<T>) {
    this.state = { ...this.state, ...state } as T;
    this.root.innerHTML = this.dom.html;
    this.handlers();
  }

  create({ show = true }: { show?: boolean }) {
    this.root.className = `${ID} hot-connector-popup`;
    this.root.innerHTML = this.dom.html;
    document.body.append(this.root);
    this.handlers();

    const modalContainer = this.root.querySelector(".modal-container")! as HTMLElement;
    const modalContent = this.root.querySelector(".modal-content")! as HTMLElement;
    modalContent.style.transform = "translateY(50px)";
    modalContainer.style.opacity = "0";
    this.root.style.display = "none";

    if (show) {
      setTimeout(() => this.show(), 10);
    }
  }

  show() {
    const modalContainer = this.root.querySelector(".modal-container")! as HTMLElement;
    const modalContent = this.root.querySelector(".modal-content")! as HTMLElement;

    modalContent.style.transform = "translateY(50px)";
    modalContainer.style.opacity = "0";
    this.root.style.display = "block";

    setTimeout(() => {
      modalContent.style.transform = "translateY(0)";
      modalContainer.style.opacity = "1";
    }, 100);
  }

  hide() {
    const modalContainer = this.root.querySelector(".modal-container")! as HTMLElement;
    const modalContent = this.root.querySelector(".modal-content")! as HTMLElement;
    modalContent.style.transform = "translateY(50px)";
    modalContainer.style.opacity = "0";

    setTimeout(() => {
      this.root.style.display = "none";
    }, 200);
  }

  destroy() {
    if (this.isClosed) return;
    this.isClosed = true;
    this.hide();
    setTimeout(() => {
      this.root.remove();
    }, 200);
  }
}
