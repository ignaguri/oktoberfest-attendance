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
import leaderboardRoutes from "../leaderboard.route";

describe("Leaderboard Routes - Unit Tests", () => {
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
    app.route("/", leaderboardRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /leaderboard", () => {
    it("should get global leaderboard with pagination", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockLeaderboard = [
        {
          user_id: "user1",
          username: "topuser",
          full_name: "Top User",
          avatar_url: "https://example.com/avatar1.jpg",
          days_attended: 10,
          total_beers: 50,
          avg_beers: 5.0,
        },
        {
          user_id: "user2",
          username: "secondplace",
          full_name: "Second User",
          avatar_url: null,
          days_attended: 8,
          total_beers: 40,
          avg_beers: 5.0,
        },
      ];

      // Mock leaderboard query (uses RPC)
      // Note: Repository calculates total from data.length, not count field
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: mockLeaderboard,
        error: null,
      } as any);

      const req = createAuthRequest(
        `/leaderboard?festivalId=${festivalId}&limit=50&offset=0`,
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
      expect(body).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: "user1",
            username: "topuser",
            daysAttended: 10,
            totalBeers: 50,
            position: 1,
          }),
          expect.objectContaining({
            userId: "user2",
            username: "secondplace",
            daysAttended: 8,
            totalBeers: 40,
            position: 2,
          }),
        ]),
        total: 2, // Total calculated from mockLeaderboard.length
        limit: 50,
        offset: 0,
      });
    });

    it("should support different sort options", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockLeaderboard = [
        {
          user_id: "user1",
          username: "consistent",
          full_name: "Consistent User",
          avatar_url: null,
          days_attended: 16,
          total_beers: 48,
          avg_beers: 3.0,
        },
      ];

      // Mock leaderboard query sorted by days_attended
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: mockLeaderboard,
        error: null,
        count: 50,
      } as any);

      const req = createAuthRequest(
        `/leaderboard?festivalId=${festivalId}&sortBy=days_attended&limit=10&offset=0`,
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
      expect(body.data[0].daysAttended).toBe(16);

      // Verify RPC was called with correct winning_criteria_id (1 = days_attended)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "get_global_leaderboard",
        expect.objectContaining({
          p_winning_criteria_id: 1, // days_attended maps to ID 1
          p_festival_id: festivalId,
        }),
      );
    });

    it("should validate required festivalId query parameter", async () => {
      const req = createAuthRequest(`/leaderboard?limit=50&offset=0`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate UUID format for festivalId", async () => {
      const req = createAuthRequest(
        `/leaderboard?festivalId=invalid-uuid&limit=50&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock database error
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: {
          name: "PostgrestError",
          message: "Database error",
          details: "",
          hint: "",
          code: "PGRST000",
        },
      } as any);

      const req = createAuthRequest(
        `/leaderboard?festivalId=${festivalId}&limit=50&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });
  });

  describe("GET /groups/:id/leaderboard", () => {
    // TODO: Fix mock chain setup - third .from() call returns null instead of mocked data
    it.skip("should get group leaderboard for members", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174000";

      // Mock findById - group exists (from GroupRepository)
      const mockGroup = {
        id: groupId,
        name: "Test Group",
        festival_id: "fest123",
        winning_criteria_id: 1,
        invite_token: "abc123",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        winning_criteria: {
          id: 1,
          name: "Total Beers",
          criteria_type: "total_beers",
        },
      };

      // Mock isMember check - user is member (queries group_members table, uses maybeSingle)
      const mockMember = {
        id: "member123",
        user_id: mockUser.id,
        group_id: groupId,
      };

      // Mock group query from LeaderboardRepository.getForGroup (gets winning_criteria_id)
      const mockGroupData = {
        winning_criteria_id: 1,
        festival_id: "fest123",
      };

      // Mock group leaderboard query
      const mockLeaderboard = [
        {
          user_id: "user1",
          username: "leader",
          full_name: "Group Leader",
          avatar_url: null,
          days_attended: 10,
          total_beers: 50,
          avg_beers: 5.0,
        },
        {
          user_id: mockUser.id,
          username: "test",
          full_name: "Test User",
          avatar_url: null,
          days_attended: 5,
          total_beers: 25,
          avg_beers: 5.0,
        },
      ];

      // Set up all mocks in sequence
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(mockGroup)))
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(mockMember)))
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupData)),
        );

      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: mockLeaderboard,
        error: null,
      } as any);

      const req = createAuthRequest(`/groups/${groupId}/leaderboard`, {
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
            userId: "user1",
            username: "leader",
            totalBeers: 50,
            position: 1,
          }),
          expect.objectContaining({
            userId: mockUser.id,
            username: "test",
            totalBeers: 25,
            position: 2,
          }),
        ]),
      });
    });

    // TODO: Fix mock chain setup - third .from() call returns null instead of mocked data
    it.skip("should support optional sort parameter", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174000";

      // Mock findById
      const mockGroup = {
        id: groupId,
        name: "Test Group",
        festival_id: "fest123",
        winning_criteria_id: 2,
        invite_token: "abc123",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        winning_criteria: {
          id: 2,
          name: "Avg Beers",
          criteria_type: "avg_beers",
        },
      };

      // Mock isMember check
      const mockMember = {
        id: "member123",
        user_id: mockUser.id,
        group_id: groupId,
      };

      // Mock group query from LeaderboardRepository.getForGroup
      const mockGroupData = {
        winning_criteria_id: 2,
        festival_id: "fest123",
      };

      // Mock group leaderboard with avg_beers sort
      const mockLeaderboard = [
        {
          user_id: "user1",
          username: "efficient",
          full_name: "Efficient User",
          avatar_url: null,
          days_attended: 5,
          total_beers: 40,
          avg_beers: 8.0,
        },
      ];

      // Set up all mocks in sequence
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(mockGroup)))
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(mockMember)))
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupData)),
        );

      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: mockLeaderboard,
        error: null,
      } as any);

      const req = createAuthRequest(
        `/groups/${groupId}/leaderboard?sortBy=avg_beers`,
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
      expect(body.data[0].avgBeers).toBe(8.0);
    });

    it("should return 404 when group not found", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174999";

      // Mock findById - group not found
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Not found", "PGRST116")),
      );

      const req = createAuthRequest(`/groups/${groupId}/leaderboard`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toMatchObject({
        message: "Group not found",
        code: "NOT_FOUND",
      });
    });

    it("should return 403 when user is not a member", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174000";

      // Mock findById - group exists
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: groupId,
            name: "Private Group",
            festival_id: "fest123",
            winning_criteria_id: 1,
            invite_token: "abc123",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            winning_criteria: {
              id: 1,
              name: "Total Beers",
              criteria_type: "total_beers",
            },
          }),
        ),
      );

      // Mock isMember check - user is NOT a member (empty result)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(`/groups/${groupId}/leaderboard`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toMatchObject({
        message: "You are not a member of this group",
        code: "FORBIDDEN",
      });
    });

    it("should validate UUID format for group ID", async () => {
      const req = createAuthRequest(`/groups/invalid-uuid/leaderboard`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174000";

      // Mock findById - success
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: groupId,
            name: "Test Group",
            festival_id: "fest123",
            winning_criteria_id: 1,
            invite_token: "abc123",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            winning_criteria: {
              id: 1,
              name: "Total Beers",
              criteria_type: "total_beers",
            },
          }),
        ),
      );

      // Mock isMember check - success
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([{ user_id: mockUser.id, group_id: groupId }]),
        ),
      );

      // Mock group query from LeaderboardRepository.getForGroup - error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Database error", "PGRST000")),
      );

      const req = createAuthRequest(`/groups/${groupId}/leaderboard`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /leaderboard", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/leaderboard?festivalId=${festivalId}&limit=50&offset=0`,
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

    it("should require authentication for GET /groups/:id/leaderboard", async () => {
      const groupId = "923e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/groups/${groupId}/leaderboard`,
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
  });
});
