import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      get getSession() {
        return getSession;
      },
    },
  },
}));
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logApiRequest: vi.fn(),
    logApiResponse: vi.fn(),
    logApiError: vi.fn(),
  },
}));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { apiUrl: "https://example.test/api" }, version: "9.9.9" },
  },
}));
// api-client reads Platform.OS to label the session. The real react-native
// entry point is Flow-typed and cannot be parsed by the node test environment,
// and this is the only test that loads the real api-client module (sync-manager
// mocks it wholesale), so the stub lives here rather than in a shared setup.
const platformOS = vi.hoisted(() => ({ current: "ios" as string }));
vi.mock("react-native", () => ({
  get Platform() {
    return { OS: platformOS.current };
  },
}));

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

describe("getAuthHeaders (via apiClient)", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
  });

  it("attaches a Bearer token when a session exists", async () => {
    getSession.mockResolvedValue({
      data: {
        session: { access_token: "tok-123", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      },
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

describe("client identification headers", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    getSession.mockResolvedValue({
      data: {
        session: { access_token: "tok-123", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      },
    });
    platformOS.current = "ios";
  });

  it("sends the platform and app version the API records on user_active_days", async () => {
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("ios");
    expect(headers["X-Client-Version"]).toBe("9.9.9");
  });

  it("reports android when running there", async () => {
    platformOS.current = "android";
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("android");
  });

  it("omits the platform header rather than guessing on an unshipped platform", async () => {
    platformOS.current = "windows";
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("X-Client-Platform");
    // The version is still useful on its own, so it must survive.
    expect(headers["X-Client-Version"]).toBe("9.9.9");
  });

  it("keeps sending the auth token alongside them", async () => {
    const fetchMock = await callFestivalsAndCaptureHeaders();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
