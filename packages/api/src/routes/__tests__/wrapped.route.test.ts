import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { evaluateAfterWrite } from "../../services/evaluate-after-write";
import { WrappedService } from "../../services/wrapped.service";
import wrappedRoutes from "../wrapped.route";
import full from "../../repositories/supabase/__tests__/fixtures/wrapped-data.full.json";
import { mapToWrappedData } from "../../repositories/supabase/wrapped-mapper";

vi.mock("../../services/wrapped.service", () => ({
  WrappedService: vi.fn(),
}));

vi.mock("../../services/evaluate-after-write", () => ({
  evaluateAfterWrite: vi.fn().mockResolvedValue(undefined),
}));

const festivalId = "123e4567-e89b-12d3-a456-426614174000";

describe("Wrapped routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockService: {
    getWrapped: ReturnType<typeof vi.fn>;
    listFestivals: ReturnType<typeof vi.fn>;
    checkAccessLegacy: ReturnType<typeof vi.fn>;
    regenerateCache: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    const mockSupabase = createMockSupabase();
    const mockUser = createMockUser();
    mockService = {
      getWrapped: vi.fn(),
      listFestivals: vi.fn(),
      checkAccessLegacy: vi.fn(),
      regenerateCache: vi.fn(),
    };
    vi.mocked(WrappedService).mockImplementation(function () {
      return mockService as never;
    });
    app.use("*", async (c, next) => {
      if (!c.req.header("Authorization")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });
    app.route("/", wrappedRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /wrapped lists festivals (not shadowed by /wrapped/{festivalId})", async () => {
    mockService.listFestivals.mockResolvedValue([
      {
        festivalId,
        name: "Oktoberfest 2026",
        startDate: "2026-09-19",
        endDate: "2026-10-04",
        unlocksAt: "2026-10-04T22:00:00.000Z",
        viewed: false,
      },
    ]);
    const res = await app.request(createAuthRequest("/wrapped"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { festivals: unknown[] };
    expect(body.festivals).toHaveLength(1);
  });

  it("GET /wrapped/{id} returns ready with camelCase data", async () => {
    mockService.getWrapped.mockResolvedValue({
      result: { status: "ready", wrapped: mapToWrappedData(full), officialStats: null },
      viewRecorded: true,
    });
    const res = await app.request(createAuthRequest(`/wrapped/${festivalId}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      wrapped: { drinkStats: { totalDrinks: number } };
    };
    expect(body.status).toBe("ready");
    expect(body.wrapped.drinkStats.totalDrinks).toBe(14);
  });

  it("GET /wrapped/{id} returns locked with unlocksAt", async () => {
    mockService.getWrapped.mockResolvedValue({
      result: { status: "locked", unlocksAt: "2026-10-04T22:00:00.000Z" },
      viewRecorded: false,
    });
    const res = await app.request(createAuthRequest(`/wrapped/${festivalId}`));
    expect(await res.json()).toEqual({ status: "locked", unlocksAt: "2026-10-04T22:00:00.000Z" });
  });

  it("GET /wrapped/{id} skips achievement evaluation for a preview", async () => {
    mockService.getWrapped.mockResolvedValue({
      result: { status: "ready", wrapped: mapToWrappedData(full), officialStats: null },
      viewRecorded: false,
    });
    const res = await app.request(createAuthRequest(`/wrapped/${festivalId}`));
    expect(res.status).toBe(200);
    expect(evaluateAfterWrite).not.toHaveBeenCalled();
  });

  it("GET /wrapped/{id}/access keeps the legacy shape", async () => {
    mockService.checkAccessLegacy.mockResolvedValue({ allowed: false, reason: "not_ended" });
    const res = await app.request(createAuthRequest(`/wrapped/${festivalId}/access`));
    expect(await res.json()).toEqual({ allowed: false, reason: "not_ended" });
  });
});
