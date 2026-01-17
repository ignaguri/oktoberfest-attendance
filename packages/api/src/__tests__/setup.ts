import { config } from "dotenv";
import { resolve } from "path";
import { afterAll, beforeAll } from "vitest";

beforeAll(() => {
  // Load environment variables from .env.test or .env.local
  // Checks in order: .env.test → .env.local
  const rootDir = resolve(__dirname, "../../../..");

  config({ path: resolve(rootDir, ".env.test") }); // Test-specific vars (if exists)
  config({ path: resolve(rootDir, ".env.local") }); // Local development vars

  // Global test setup
  process.env.NODE_ENV = "test";

  // Integration tests require local Supabase to be running
  // Environment variables should be set in .env.local or .env.test:
  // - NEXT_PUBLIC_SUPABASE_URL (e.g., http://localhost:54321)
  // - NEXT_PUBLIC_SUPABASE_ANON_KEY (from `supabase status`)
  // - SUPABASE_SERVICE_ROLE_KEY (from `supabase status`)
});

afterAll(() => {
  // Cleanup
});
