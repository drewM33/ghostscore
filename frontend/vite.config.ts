import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backend = { target: "http://localhost:3000", changeOrigin: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": { ...backend, ws: true },
      "/api": backend,
      "/agent": backend,
      "/agents": backend,
      "/provider": backend,
      "/governance": backend,
      "/health": backend,
      "/pay": backend,
    },
  },
});
