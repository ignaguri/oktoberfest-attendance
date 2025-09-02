import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
