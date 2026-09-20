import { createMiddleware } from "hono/factory";

import { logger } from "../lib/logger";
import type { AuthContext } from "./auth";
import { ForbiddenError, UnauthorizedError } from "./error";

/**
 * Admin authorization middleware
 *
 * Runs after authMiddleware and rejects anyone whose profile does not carry
 * is_super_admin. Mounted once on the `/admin/*` prefix so a new admin route
 * is guarded the moment it is added -- the alternative (an isAdmin() call at
 * the top of every handler) is one forgotten line away from an open endpoint.
 *
 * The check reads through the caller's own token rather than the service role.
 * `profiles` is world-readable for SELECT ("Public profiles are viewable by
 * everyone"), so no elevated client is needed just to answer "am I an admin".
 */
export const requireAdmin = createMiddleware<AuthContext>(async (c, next) => {
  const { user, supabase } = c.var;

  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // A missing or unreadable profile is not an admin. Logged because it means
    // an authenticated user has no profile row, which should not happen.
    logger.warn(
      { userId: user.id, error: error?.message },
      "Admin check could not read profile; denying",
    );
    throw new ForbiddenError("Admin access required");
  }

  if (profile.is_super_admin !== true) {
    logger.warn(
      { userId: user.id, path: c.req.path, method: c.req.method },
      "Non-admin attempted to reach an admin endpoint",
    );
    throw new ForbiddenError("Admin access required");
  }

  await next();
});
