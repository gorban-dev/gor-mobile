import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  shims: true,
  dts: false,
  splitting: false,
  minify: false
});
