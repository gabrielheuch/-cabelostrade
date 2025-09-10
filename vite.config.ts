import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflareVitePlugin } from "@cloudflare/vite-plugin";
import { getMochaVitePlugins } from "@getmocha/vite-plugins";

export default defineConfig({
  plugins: [
react(),
...getMochaVitePlugins(),
cloudflareVitePlugin(),
  ],
  build: {
outDir: "dist",
emptyOutDir: true,
rollupOptions: {
  output: {
    manualChunks: {
      vendor: ["react", "react-dom"],
      router: ["react-router"],
      ui: ["lucide-react"],
    },
  },
},
  },
  resolve: {
alias: {
  "@": "/src",
},
  },
  optimizeDeps: {
include: ["react", "react-dom", "react-router", "lucide-react"],
  },
});
