import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ error: null }) },
  }),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), apiRoute: vi.fn() } }));

import { GET } from "../route";

const callback = (redirect: string) =>
  new NextRequest(
    `http://localhost:3008/auth/callback?code=abc&redirect=${encodeURIComponent(redirect)}`,
  );

describe("auth callback", () => {
  it("keeps the query string of an allowed redirect", async () => {
    const response = await GET(callback("/home?feedback=idea"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname + location.search).toBe("/home?feedback=idea");
  });

  it("still falls back to /home for a path outside the allow list", async () => {
    const response = await GET(callback("/somewhere-else?x=1"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname + location.search).toBe("/home");
  });
});
