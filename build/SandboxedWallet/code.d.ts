import SandboxExecutor from "./executor";
declare function getIframeCode(args: {
    id: string;
    executor: SandboxExecutor;
    code: string;
    cspNonce?: string;
}): Promise<string>;
export default getIframeCode;
