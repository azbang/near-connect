import { defineConfig } from "tsup";

const globalName = "HOTConnect";

export default defineConfig([
  // 1) CommonJS (CJS) build — unbundled, preserves module structure
  {
    entry: ["src/**/*.ts"],
    outDir: "dist/cjs",
    format: ["cjs"],
    bundle: false,
    splitting: false,
    clean: true,
    keepNames: true,
    dts: {
      resolve: true,
      entry: ["src/index.ts"],
    },
    sourcemap: true,
    minify: false,
  },

  // 2) ESM build — unbundled, preserves module structure
  {
    entry: ["src/**/*.ts"],
    outDir: "dist/esm",
    format: ["esm"],
    shims: true,
    bundle: false,
    splitting: false,
    clean: true,
    keepNames: true,
    dts: {
      resolve: true,
      entry: ["src/index.ts"],
    },
    sourcemap: true,
    minify: false,
  },

  // 3) IIFE build — fully bundled for browser <script> tags
  {
    entry: { browser: "src/index.ts" },
    outDir: "dist/umd",
    format: ["iife"],
    globalName,
    bundle: true,
    splitting: false,
    clean: true,
    keepNames: true,
    dts: false,
    sourcemap: true,
    minify: false,
    platform: "browser",
  },
]);
