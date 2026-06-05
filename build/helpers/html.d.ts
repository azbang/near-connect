export declare function escapeHtml(unsafe: string): string;
declare const htmlTag: unique symbol;
export interface HtmlString {
    [htmlTag]: string;
    html: string;
}
export declare function html(strings: TemplateStringsArray, ...values: any[]): HtmlString;
export {};
