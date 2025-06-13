import path from "path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve(__dirname, "src"),
      "@ports": path.resolve(__dirname, "src/ports"),
      "@adapters": path.resolve(__dirname, "src/adapters"),
      "@domain": path.resolve(__dirname, "src/domain"),
    };
  },
});
