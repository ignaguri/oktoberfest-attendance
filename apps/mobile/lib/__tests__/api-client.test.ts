import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../supabase", () => ({
  supabase: { auth: { get getSession() { return getSession; } } },
}));
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(),
    logApiRequest: vi.fn(), logApiResponse: vi.fn(), logApiError: vi.fn(),
  },
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { apiUrl: "https://example.test/api" } } },
}));

async function callFestivalsAndCaptureHeaders() {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true, status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    clone() { return this; },
    async json() { return { festivals: [] }; },
  }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  const { apiClient } = await import("../api-client");
  await apiClient.festivals.list().catch(() => {});
  return fetchMock;
}

describe("getAuthHeaders (via apiClient)", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
  });

  it("attaches a Bearer token when a session exists", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-123", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    });
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("throws AuthRequiredError and fires NO request when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { apiClient } = await import("../api-client");
    const { AuthRequiredError } = await import("@prostcounter/api-client");
    await expect(apiClient.festivals.list()).rejects.toBeInstanceOf(AuthRequiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
