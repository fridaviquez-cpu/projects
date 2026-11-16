import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Isolated renderer fixture: no API, authentication, or persisted student data.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ["tests/tutor-markdown.html"] },
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
});
