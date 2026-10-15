import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: process.env["BEEZ_ENV_DIR"] ?? "..",
  plugins: [tailwindcss(), tanstackStart({ server: { entry: "server" } }), react()],
  resolve: { tsconfigPaths: true },
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": process.env["BEEZ_API_TARGET"] ?? "http://localhost:8080",
    },
  },
});
