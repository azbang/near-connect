import { FooterBranding } from "../types";
import { Popup } from "./Popup";
export declare class IframeWalletPopup extends Popup<{}> {
    readonly delegate: {
        iframe: HTMLIFrameElement;
        footer: FooterBranding | null;
        onApprove: () => void;
        onReject: () => void;
    };
    constructor(delegate: {
        iframe: HTMLIFrameElement;
        footer: FooterBranding | null;
        onApprove: () => void;
        onReject: () => void;
    });
    handlers(): void;
    create(): void;
    get footer(): import("../helpers/html").HtmlString | "";
    get dom(): import("../helpers/html").HtmlString;
}
