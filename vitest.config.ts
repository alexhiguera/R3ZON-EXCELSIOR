import path from "node:path";
import { defineConfig } from "vitest/config";

// Sin `@vitejs/plugin-react`: Vite transforma el JSX por su cuenta con el
// runtime automático (`"jsx": "react-jsx"` en tsconfig). Se comprobó quitándolo.
export default defineConfig({
  // Vitest no procesa CSS: sin esto intentaría cargar la config de PostCSS.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    // `node` por defecto; los tests de componentes piden jsdom con el pragma
    // `// @vitest-environment jsdom` en su cabecera.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Los tests de BD comparten una única base: en paralelo entre ficheros,
    // dos transacciones podrían pisarse en los objetos globales (auth.users).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
      exclude: ["src/lib/database.types.ts"],
    },
  },
});
