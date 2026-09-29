import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { SupabaseOfficialStatsRepository } from "../../repositories/supabase/official-stats.repository";
import adminOfficialStatsRoutes from "../admin-official-stats.route";

vi.mock("../../repositories/supabase/official-stats.repository", () => ({
  SupabaseOfficialStatsRepository: vi.fn(),
}));

const festivalId = "123e4567-e89b-12d3-a456-426614174000";
const find = { de: "ein Akkordeon", en: "an accordion", es: "un acordeón" };
const body = {
  visitors: 6500000,
  massServed: 6500000,
  mugsConfiscated: 116000,
  lostItems: 4500,
  curiousFinds: [find],
  sourceUrl: "https://www.muenchen.de/x",
};

describe("Admin official stats routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockRepo: { getForAdmin: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    app = createTestApp();
    mockRepo = { getForAdmin: vi.fn(), upsert: vi.fn() };
    vi.mocked(SupabaseOfficialStatsRepository).mockImplementation(function () {
      return mockRepo as never;
    });
    app.use("*", async (c, next) => {
      c.set("user", createMockUser());
      c.set("supabase", createMockSupabase());
      await next();
    });
    app.route("/", adminOfficialStatsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns null when nothing is stored", async () => {
    mockRepo.getForAdmin.mockResolvedValue(null);
    const res = await app.request(createAuthRequest(`/admin/festivals/${festivalId}/official-stats`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stats: null });
  });

  it("PUT upserts a valid body", async () => {
    mockRepo.upsert.mockResolvedValue({ festivalId, ...body, updatedAt: "2026-10-04T20:00:00.000Z" });
    const res = await app.request(
      createAuthRequest(`/admin/festivals/${festivalId}/official-stats`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRepo.upsert).toHaveBeenCalledWith(festivalId, body);
  });

  it("PUT rejects more than three finds", async () => {
    const res = await app.request(
      createAuthRequest(`/admin/festivals/${festivalId}/official-stats`, {
        method: "PUT",
        body: JSON.stringify({ ...body, curiousFinds: [find, find, find, find] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockRepo.upsert).not.toHaveBeenCalled();
  });
});
