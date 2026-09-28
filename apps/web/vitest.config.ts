import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig has jsx: "preserve" (Next compiles JSX itself), so Vite would fall back to the classic
  // React.createElement transform and component tests would need `import React` everywhere.
  esbuild: { jsx: "automatic" },
  // Same as the root config; also lets Testing Library auto-clean the DOM between tests.
  test: { globals: true },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
