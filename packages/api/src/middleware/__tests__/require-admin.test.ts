import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthContext } from "../auth";
import { errorHandler } from "../error";
import { requireAdmin } from "../require-admin";

/**
 * Builds a Supabase stub whose profiles lookup resolves to the given result.
 * Only the `.from().select().eq().single()` chain requireAdmin uses is modelled.
 */
function stubSupabase(result: {
  data: { is_super_admin: boolean | null } | null;
  error?: unknown;
}) {
  const single = vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, eq, single },
  };
}

/** Mounts requireAdmin behind a stub auth layer, with an optional route spy. */
function createApp(
  vars: { userId?: string; supabase: SupabaseClient },
  handler: () => Response | Promise<Response> = () => Response.json({ ok: true }),
) {
  const app = new Hono<AuthContext>();
  app.onError(errorHandler);
  app.use("*", async (c, next) => {
    // Stands in for authMiddleware, which normally sets these.
    c.set("user", (vars.userId ? { id: vars.userId } : undefined) as unknown as User);
    c.set("supabase", vars.supabase);
    await next();
  });
  app.use("*", requireAdmin);
  app.get("/admin/thing", () => handler());
  return app;
}

describe("requireAdmin", () => {
  it("lets a super admin through", async () => {
    const supabase = stubSupabase({ data: { is_super_admin: true } });
    const app = createApp({ userId: "admin-user", supabase: supabase.client });

    const res = await app.request("/admin/thing");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(supabase.spies.from).toHaveBeenCalledWith("profiles");
    expect(supabase.spies.eq).toHaveBeenCalledWith("id", "admin-user");
  });

  it("rejects a signed-in user who is not an admin", async () => {
    const app = createApp({
      userId: "regular-user",
      supabase: stubSupabase({ data: { is_super_admin: false } }).client,
    });

    expect((await app.request("/admin/thing")).status).toBe(403);
  });

  it("rejects when the flag is null rather than false", async () => {
    const app = createApp({
      userId: "regular-user",
      supabase: stubSupabase({ data: { is_super_admin: null } }).client,
    });

    expect((await app.request("/admin/thing")).status).toBe(403);
  });

  it("denies rather than throwing when the profile cannot be read", async () => {
    const app = createApp({
      userId: "ghost-user",
      supabase: stubSupabase({ data: null, error: { message: "no rows" } }).client,
    });

    expect((await app.request("/admin/thing")).status).toBe(403);
  });

  it("rejects when no authenticated user is on the context", async () => {
    const app = createApp({
      supabase: stubSupabase({ data: { is_super_admin: true } }).client,
    });

    // 401, not 403: the caller is unauthenticated, not merely unauthorized.
    expect((await app.request("/admin/thing")).status).toBe(401);
  });

  it("does not reach the handler when access is denied", async () => {
    const handler = vi.fn(() => Response.json({ ok: true }));
    const app = createApp(
      {
        userId: "regular-user",
        supabase: stubSupabase({ data: { is_super_admin: false } }).client,
      },
      handler,
    );

    await app.request("/admin/thing");

    expect(handler).not.toHaveBeenCalled();
  });
});
