export declare class Popup<T extends Record<string, any>> {
    readonly delegate: {
        onReject: () => void;
    };
    isClosed: boolean;
    root: HTMLDivElement;
    state: T;
    constructor(delegate: {
        onReject: () => void;
    });
    get dom(): import("../helpers/html").HtmlString;
    disposables: (() => void)[];
    addListener(querySelector: string | Element, event: string, callback: (e: Event) => void): void;
    handlers(): void;
    update(state: Partial<T>): void;
    create({ show }: {
        show?: boolean;
    }): void;
    show(): void;
    hide(): void;
    destroy(): void;
}
