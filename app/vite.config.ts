import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/renderer",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
      "@renderer": resolve(__dirname, "src/renderer")
    }
  }
});

