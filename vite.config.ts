import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { generateSitemap } from "tanstack-router-sitemap";
import { sitemap } from './utils/sitemap'

export default defineConfig(({ command, mode }) => {
  const isBuild = command === "build" || mode === "production";

  return {
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
    plugins: [
      devtools(),
      nitro(
        isBuild
          ? {
              externals: {
                inline: ["react-reconciler", "its-fine"],
              },
            }
          : undefined
      ),
      viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      generateSitemap(sitemap),
    ],
  };
});
