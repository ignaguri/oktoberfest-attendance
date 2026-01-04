import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration for integration tests.
 * These tests require a running local Supabase instance.
 *
 * Run with: pnpm test:integration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Only include integration tests
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/*.d.ts"],
    // Integration tests may take longer
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Run integration tests sequentially to avoid race conditions
    // with Supabase auth user creation triggers
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Run test files sequentially (not just tests within files)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
