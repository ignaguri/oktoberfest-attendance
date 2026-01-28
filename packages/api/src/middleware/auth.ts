import type { User } from "@supabase/supabase-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";

import { logger } from "../lib/logger";
import { UnauthorizedError } from "./error";

// Extend Hono context to include user
export type AuthContext = {
  Variables: {
    user: User;
    supabase: SupabaseClient;
  };
};

/**
 * Authentication middleware
 * Validates Supabase JWT token from Authorization header
 * Adds authenticated user and supabase client to context
 */
export const authMiddleware = createMiddleware<AuthContext>(async (c, next) => {
  // Get authorization header
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  // Extract token (format: "Bearer <token>")
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    throw new UnauthorizedError("Invalid authorization header format");
  }

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials not configured");
  }

  // Create Supabase client with user's token
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify token and get user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  // Add user and supabase client to context
  c.set("user", user);
  c.set("supabase", supabase);

  await next();
});

/**
 * Optional authentication middleware
 * Similar to authMiddleware but doesn't throw if no auth is provided
 * User will be undefined if not authenticated
 */
export const optionalAuthMiddleware = createMiddleware<
  AuthContext & { Variables: { user?: User } }
>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser(token);

        if (user) {
          c.set("user", user);
          c.set("supabase", supabase);
        }
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.warn({ error }, "Optional auth failed");
    }
  }

  await next();
});
