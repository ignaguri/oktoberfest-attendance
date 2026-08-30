import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyMetrics } from "../../__tests__/helpers/achievement-metrics";
import {
  createMockChain,
  createMockSupabase,
  mockSupabaseError,
  mockSupabaseSuccess,
} from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import achievementRoutes from "../achievement.route";

describe("Achievement Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Mock auth middleware by setting context directly - MUST come before route mounting
    app.use("*", async (c, next) => {
      const authHeader = c.req.header("Authorization");

      // Routes without auth header should fail with 401
      if (!authHeader) {
        return c.json({ error: "Unauthorized", message: "Missing authorization header" }, 401);
      }

      // Set mock user and supabase for authenticated requests
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    // Mount route after middleware
    app.route("/", achievementRoutes);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /achievements", () => {
    it("should list user's achievements for a festival", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockAchievements = [
        {
          id: "ae1e4567-e89b-12d3-a456-426614174001",
          user_id: mockUser.id,
          achievement_id: "ac1e4567-e89b-12d3-a456-426614174001",
          festival_id: festivalId,
          rarity: "rare",
          created_at: "2024-09-21T14:00:00Z",
          user_notified_at: "2024-09-21T14:01:00Z",
          group_notified_at: null,
          achievements: {
            id: "ac1e4567-e89b-12d3-a456-426614174001",
            name: "First Beer",
            description: "Log your first beer at the festival",
            category: "consumption",
            icon: "🍺",
            points: 10,
            rarity: "common",
            condition: { beer_count: 1 },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        },
        {
          id: "ae1e4567-e89b-12d3-a456-426614174002",
          user_id: mockUser.id,
          achievement_id: "ac1e4567-e89b-12d3-a456-426614174002",
          festival_id: festivalId,
          rarity: "epic",
          created_at: "2024-09-22T10:00:00Z",
          user_notified_at: null,
          group_notified_at: null,
          achievements: {
            id: "ac1e4567-e89b-12d3-a456-426614174002",
            name: "Beer Master",
            description: "Log 10 beers at the festival",
            category: "consumption",
            icon: "🏆",
            points: 50,
            rarity: "epic",
            condition: { beer_count: 10 },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        },
      ];

      // Mock listUserAchievements query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAchievements)),
      );

      const req = createAuthRequest(`/achievements?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "ae1e4567-e89b-12d3-a456-426614174001",
            userId: mockUser.id,
            achievementId: "ac1e4567-e89b-12d3-a456-426614174001",
            festivalId,
            rarity: "rare",
            achievement: expect.objectContaining({
              name: "First Beer",
              category: "consumption",
              points: 10,
            }),
          }),
          expect.objectContaining({
            id: "ae1e4567-e89b-12d3-a456-426614174002",
            userId: mockUser.id,
            achievementId: "ac1e4567-e89b-12d3-a456-426614174002",
            festivalId,
            rarity: "epic",
            achievement: expect.objectContaining({
              name: "Beer Master",
              category: "consumption",
              points: 50,
            }),
          }),
        ]),
      });
    });

    it("should filter achievements by category", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockAchievements = [
        {
          id: "ae1e4567-e89b-12d3-a456-426614174003",
          user_id: mockUser.id,
          achievement_id: "ac1e4567-e89b-12d3-a456-426614174003",
          festival_id: festivalId,
          rarity: "rare",
          created_at: "2024-09-21T14:00:00Z",
          user_notified_at: null,
          group_notified_at: null,
          achievements: {
            id: "ac1e4567-e89b-12d3-a456-426614174003",
            name: "Social Butterfly",
            description: "Join your first group",
            category: "social",
            icon: "🦋",
            points: 20,
            rarity: "rare",
            condition: { groups_joined: 1 },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        },
      ];

      // Mock listUserAchievements query with category filter
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAchievements)),
      );

      const req = createAuthRequest(`/achievements?festivalId=${festivalId}&category=social`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].achievement.category).toBe("social");
    });

    it("should handle empty achievement list", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock empty achievements
      vi.mocked(mockSupabase.from).mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(`/achievements?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ data: [] });
    });

    it("should validate required festivalId query parameter", async () => {
      const req = createAuthRequest(`/achievements`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate UUID format for festivalId", async () => {
      const req = createAuthRequest(`/achievements?festivalId=invalid-uuid`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock database error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Failed to list achievements", "PGRST000")),
      );

      const req = createAuthRequest(`/achievements?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });

    // The joined achievement's rarity must come from its tier, not from the
    // stored column PR 2 drops. The mock deliberately disagrees: tier 4 with a
    // stored rarity of "common". Reading the column yields "common" and reading
    // the tier yields "legendary", so only a derived implementation passes.
    it("derives the joined achievement's rarity from its tier", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockAchievements = [
        {
          id: "ae1e4567-e89b-12d3-a456-426614174003",
          user_id: mockUser.id,
          achievement_id: "ac1e4567-e89b-12d3-a456-426614174003",
          festival_id: festivalId,
          rarity: "legendary",
          created_at: "2024-09-23T10:00:00Z",
          user_notified_at: null,
          group_notified_at: null,
          achievements: {
            id: "ac1e4567-e89b-12d3-a456-426614174003",
            name: "achievements.drinks_total.t4.name",
            description: "achievements.drinks_total.t4.description",
            category: "drinking",
            icon: "stein",
            points: 100,
            tier: 4,
            rarity: "common",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAchievements)),
      );

      const req = createAuthRequest(`/achievements?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].achievement.rarity).toBe("legendary");
      // The event's own rarity is a different column and is not derived.
      expect(body.data[0].rarity).toBe("legendary");
    });
  });

  describe("GET /achievements/with-progress", () => {
    it("returns 30 series cards, recent unlocks and stats", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // getHeldSlugsWithUnlockDates: user_achievements joined to achievements(slug)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([
            { unlocked_at: "2026-09-20T10:00:00Z", achievements: { slug: "drinks_total.t1" } },
            { unlocked_at: "2026-09-22T10:00:00Z", achievements: { slug: "drinks_total.t2" } },
            { unlocked_at: "2026-09-21T10:00:00Z", achievements: { slug: "first_drink" } },
          ]),
        ),
      );

      // getMetrics
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: emptyMetrics({ drinks_total: 7 }),
        error: null,
      } as any);

      const req = createAuthRequest(`/achievements/with-progress?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.cards).toHaveLength(30);

      const drinksTotal = body.cards.find((card: any) => card.id === "drinks_total");
      expect(drinksTotal.currentTier).toBe(2);
      expect(drinksTotal.tiers).toHaveLength(4);

      const firstDrink = body.cards.find((card: any) => card.id === "first_drink");
      expect(firstDrink.tiers).toHaveLength(1);
      expect(firstDrink.currentTier).toBe(1);

      expect(body.recentUnlocks.map((unlock: any) => unlock.id)).toEqual([
        "drinks_total.t2",
        "first_drink",
        "drinks_total.t1",
      ]);

      expect(body.stats.unlocked_achievements).toBe(3);
      expect(body.stats.total_achievements).toBe(90);
      expect(Object.keys(body.stats.breakdown_by_category)).not.toContain("consumption");
      expect(drinksTotal.progress).toEqual({ currentValue: 7, nextTarget: expect.any(Number) });
      expect(firstDrink.progress).toBeNull();
    });

    it("returns every card locked when the user holds nothing", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(mockSupabase.from).mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: emptyMetrics(),
        error: null,
      } as any);

      const req = createAuthRequest(`/achievements/with-progress?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.cards).toHaveLength(30);
      expect(body.cards.every((card: any) => card.currentTier === 0)).toBe(true);
      expect(body.recentUnlocks).toEqual([]);
      expect(body.stats.unlocked_achievements).toBe(0);
      expect(body.stats.total_points).toBe(0);
      expect(body.cards.every((card: any) => card.progress !== undefined)).toBe(true);
    });
  });

  describe("GET /achievements/available", () => {
    // Mobile reference sync (apps/mobile/lib/database/sync/pull-reference.ts)
    // writes this rarity into a CHECK-constrained SQLite column, so the field
    // has to keep its shape while its source moves from the stored column to
    // the tier. The mock's stored rarity disagrees with its tier on purpose.
    it("derives rarity from tier without changing the response shape", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([
            {
              id: "ac1e4567-e89b-12d3-a456-426614174010",
              name: "achievements.tents_visited.t3.name",
              description: "achievements.tents_visited.t3.description",
              category: "explorer",
              icon: "tent",
              points: 50,
              tier: 3,
              rarity: "common",
              is_active: true,
            },
          ]),
        ),
      );

      const req = createAuthRequest("/achievements/available", { method: "GET" });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "ac1e4567-e89b-12d3-a456-426614174010",
        name: "achievements.tents_visited.t3.name",
        description: "achievements.tents_visited.t3.description",
        category: "explorer",
        icon: "tent",
        points: 50,
        rarity: "epic",
        is_active: true,
      });
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /achievements", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(`http://localhost/achievements?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });
});
