import { OpenAPIHono } from "@hono/zod-openapi";

import type { AuthContext } from "../../middleware/auth";
import type { User } from "@supabase/supabase-js";

import { errorHandler } from "../../middleware/error";

/**
 * Create test Hono app instance with error handling
 */
export function createTestApp() {
  const app = new OpenAPIHono<AuthContext>();
  app.onError(errorHandler);
  return app;
}

/**
 * Mock authenticated user for tests
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

/**
 * Create test request with auth headers
 */
export function createAuthRequest(
  path: string,
  options?: RequestInit,
): Request {
  return new Request(`http://localhost${path}`, {
    ...options,
    headers: {
      Authorization: "Bearer mock-token",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  } as any) as Request;
}
