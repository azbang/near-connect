export type ResolveAuthPurpose = "PROVE_OWNERSHIP" | "APPROVE_OFFCHAIN_ACTION";
export type VerifyResolveAuthResult = {
    status: "RESOLVED";
    payload: string;
} | {
    status: "INVALID";
    errorKind?: string;
    errorMessage: string;
};
export interface VerifyResolveAuthArgs {
    rpcUrl: string;
    accountId: string;
    purpose: ResolveAuthPurpose;
    recipient: string;
    authorization: string;
    /** If omitted, the finalized block at call time is used. */
    blockId?: number;
    /** Defaults to 8. */
    maxDepth?: number;
}
export declare function verifyResolveAuth(args: VerifyResolveAuthArgs): Promise<VerifyResolveAuthResult>;
