import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      get getSession() {
        return getSession;
      },
    },
  }),
}));

// next.config.ts injects APP_VERSION from apps/web/package.json at build time,
// so it is absent under vitest. Pinned to a distinctive value to prove the
// client forwards this constant rather than some other version.
vi.mock("@/lib/version", () => ({ APP_VERSION: "9.9.9" }));

async function callFestivalsAndCaptureHeaders() {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        clone() {
          return this;
        },
        async json() {
          return { festivals: [] };
        },
      }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  const { apiClient } = await import("../api-client");
  await apiClient.festivals.list().catch(() => {});
  return fetchMock;
}

describe("client identification headers", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
    });
  });

  it("sends the platform and app version the API records on user_active_days", async () => {
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("web");
    expect(headers["X-Client-Version"]).toBe("9.9.9");
  });

  it("keeps sending the auth token alongside them", async () => {
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("still identifies the client when there is no session", async () => {
    // Unlike mobile, web's getAuthHeaders returns headers instead of throwing
    // when signed out. The middleware ignores those requests, but the client
    // must not start lying about who it is depending on auth state.
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("web");
    expect(headers).not.toHaveProperty("Authorization");
  });
});
