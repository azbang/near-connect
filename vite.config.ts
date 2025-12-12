import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "cdn",
    minify: true,
    lib: {
      entry: "src/index.ts",
      name: "HOTConnect",
      formats: ["es", "cjs", "iife"],
      fileName: (format) => `hot-connect.${format}.js`,
    },
  },
});
