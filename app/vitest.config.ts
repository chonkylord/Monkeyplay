import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
      "@main": resolve(__dirname, "src/main"),
      "@renderer": resolve(__dirname, "src/renderer")
    }
  }
});

