import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

vi.mock("@/lib/utils/security", () => ({ logAdminAction: vi.fn() }));

import { updateSession } from "../middleware";

describe("updateSession", () => {
  beforeEach(() => {
    getClaims.mockResolvedValue({ data: { claims: null } });
  });

  // The auth emails link to /r/bugs, which lands signed-out readers on
  // /home?feedback=bug; dropping the query loses the dialog after sign-in.
  it("keeps the query string in the sign-in redirect", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3008/home?feedback=bug"),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect")).toBe("/home?feedback=bug");
  });

  it("redirects a plain path without adding a query", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3008/groups"));

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/groups");
  });
});
