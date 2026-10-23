import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const appRoot = path.resolve(projectRoot, "src");

export default defineConfig({
  root: appRoot,
  publicDir: path.resolve(projectRoot, "public"),
  appType: "mpa",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": projectRoot
    }
  },
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(appRoot, "index.html"),
        admin: path.resolve(appRoot, "admin.html")
      }
    }
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== "true",
    watch: process.env.DISABLE_HMR === "true" ? null : {}
  }
});
