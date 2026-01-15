import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createMockSupabase,
  mockSupabaseSuccess,
  mockSupabaseError,
  createMockChain,
} from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
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
        return c.json(
          { error: "Unauthorized", message: "Missing authorization header" },
          401,
        );
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

      const req = createAuthRequest(
        `/achievements?festivalId=${festivalId}&category=social`,
        {
          method: "GET",
        },
      );

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
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
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
        createMockChain(
          mockSupabaseError("Failed to list achievements", "PGRST000"),
        ),
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
  });

  describe("POST /achievements/evaluate", () => {
    it("should evaluate achievements and return new unlocked achievements", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock RPC call to evaluate_user_achievements
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      // Mock listUserAchievements - return achievement unlocked just now
      const now = new Date();
      const recentAchievement = {
        id: "ae1e4567-e89b-12d3-a456-426614174010",
        user_id: mockUser.id,
        achievement_id: "ac1e4567-e89b-12d3-a456-426614174010",
        festival_id: festivalId,
        rarity: "legendary",
        created_at: now.toISOString(),
        user_notified_at: null,
        group_notified_at: null,
        achievements: {
          id: "ac1e4567-e89b-12d3-a456-426614174010",
          name: "Legend",
          description: "Complete all achievements",
          category: "special",
          icon: "👑",
          points: 500,
          rarity: "legendary",
          condition: { all_achievements: true },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([recentAchievement])),
      );

      // Mock getTotalPoints query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([
            { achievements: { points: 10 } },
            { achievements: { points: 50 } },
            { achievements: { points: 500 } },
          ]),
        ),
      );

      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({
        newAchievements: expect.arrayContaining([
          expect.objectContaining({
            id: "ae1e4567-e89b-12d3-a456-426614174010",
            achievement: expect.objectContaining({
              name: "Legend",
              points: 500,
            }),
          }),
        ]),
        totalPoints: 560, // 10 + 50 + 500
      });

      // Verify RPC was called correctly
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "evaluate_user_achievements",
        {
          p_user_id: mockUser.id,
          p_festival_id: festivalId,
        },
      );
    });

    it("should handle case with no new achievements", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock RPC call
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      // Mock listUserAchievements - return old achievement (unlocked >5s ago)
      const oldDate = new Date(Date.now() - 10000); // 10 seconds ago
      const oldAchievement = {
        id: "ae1e4567-e89b-12d3-a456-426614174011",
        user_id: mockUser.id,
        achievement_id: "ac1e4567-e89b-12d3-a456-426614174011",
        festival_id: festivalId,
        rarity: "common",
        created_at: oldDate.toISOString(),
        user_notified_at: null,
        group_notified_at: null,
        achievements: {
          id: "ac1e4567-e89b-12d3-a456-426614174011",
          name: "First Beer",
          description: "Log your first beer",
          category: "consumption",
          icon: "🍺",
          points: 10,
          rarity: "common",
          condition: { beer_count: 1 },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([oldAchievement])),
      );

      // Mock getTotalPoints query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([{ achievements: { points: 10 } }]),
        ),
      );

      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({
        newAchievements: [], // No achievements unlocked within last 5 seconds
        totalPoints: 10,
      });
    });

    it("should calculate total points correctly", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock RPC call
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      // Mock listUserAchievements - no new achievements
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      // Mock getTotalPoints query with multiple achievements
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([
            { achievements: { points: 10 } },
            { achievements: { points: 20 } },
            { achievements: { points: 30 } },
            { achievements: { points: 50 } },
          ]),
        ),
      );

      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.totalPoints).toBe(110); // 10 + 20 + 30 + 50
    });

    it("should validate required festivalId in body", async () => {
      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate UUID format for festivalId", async () => {
      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId: "invalid-uuid",
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle RPC errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock RPC error
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: {
          name: "PostgrestError",
          message: "RPC function failed",
          details: "",
          hint: "",
          code: "42883",
        },
      } as any);

      const req = createAuthRequest("/achievements/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /achievements", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/achievements?festivalId=${festivalId}`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /achievements/evaluate", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(`http://localhost/achievements/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });
  });
});
