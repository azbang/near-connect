// postMessage copies its payload with the structured clone algorithm, which throws a DataCloneError
// for functions, DOM nodes, objects holding either, and (on older WebKit) Error objects.
export const isDataCloneError = (e: unknown) => (e as { name?: unknown } | null)?.name === "DataCloneError";

// Reduce an error thrown by third-party code (an injected wallet, WalletConnect) to plain data.
export const toCloneableError = (error: unknown): unknown => {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const hasCode = typeof code === "string" || typeof code === "number";
    return { name: error.name, message: error.message, ...(hasCode ? { code } : {}) };
  }

  if (typeof error === "object" && error !== null) {
    try {
      // Drops functions and other non-data fields; throws on BigInt and cycles
      return JSON.parse(JSON.stringify(error));
    } catch {}
  }

  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : String(error);
};
