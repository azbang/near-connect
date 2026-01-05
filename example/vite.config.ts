import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tailwindcss from "@tailwindcss/vite";
import { existsSync } from "fs";
import path from "path";

import tsconfig from "./tsconfig.json";

const kitLocalPath = path.resolve(__dirname, "../src");
const useLocalKit = process.env.NODE_ENV !== "production" && existsSync(kitLocalPath);
if (!useLocalKit) {
  // @ts-expect-error: delete paths from tsconfig
  delete tsconfig.compilerOptions.paths;
}

export default defineConfig({
  server: { port: 1234 },
  plugins: [nodePolyfills(), react(), tailwindcss()],
  base: "/near-connect/",

  resolve: {
    alias: useLocalKit ? { "@hot-labs/near-connect": kitLocalPath } : {},
  },
  optimizeDeps: {
    esbuildOptions: {
      tsconfigRaw: process.env.NODE_ENV === "production" ? JSON.stringify(tsconfig) : undefined,
    },
  },
});
