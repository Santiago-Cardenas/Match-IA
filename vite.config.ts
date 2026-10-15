import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    // Servidor Node para Render: `node .output/server/index.mjs`
    nitro({ preset: "node-server" }),
  ],
  optimizeDeps: { include: ["@radix-ui/react-dialog", "@radix-ui/react-progress"] },
});
