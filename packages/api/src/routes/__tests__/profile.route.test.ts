import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import profileRoutes from "../profile.route";

describe("Profile Routes - GET /profiles/:userId (Public Profile)", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  const currentUserId = "223e4567-e89b-12d3-a456-426614174000";
  const targetUserId = "123e4567-e89b-12d3-a456-426614174001";
  const festivalId = "123e4567-e89b-12d3-a456-426614174099";

  const mockProfileRow = {
    id: targetUserId,
    username: "beermaster",
    full_name: "Hans Schmidt",
    avatar_url: "avatars/hans.webp",
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser({ id: currentUserId });

    // Override auth.getUser to return our currentUserId
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    app.use("*", async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader) {
        return c.json(
          { error: "Unauthorized", message: "Missing authorization header" },
          401,
        );
      }
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    app.route("/", profileRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(userId: string, query = "") {
    const req = createAuthRequest(`/profiles/${userId}${query}`, {
      method: "GET",
    });
    return app.request(req.url, {
      method: req.method,
      headers: req.headers,
    });
  }

  describe("friendship status", () => {
    it("should return 'self' when viewing own profile", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({ ...mockProfileRow, id: currentUserId }),
        ),
      );

      // currentUserId is passed from route via c.var.user.id

      const res = await makeRequest(currentUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.friendshipStatus).toBe("self");
      expect(body.profile.sharedGroups).toBeNull();
    });

    it("should return 'friends' when users are friends", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: "friendship-1",
            requester_id: currentUserId,
            status: "accepted",
          }),
        ),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.friendshipStatus).toBe("friends");
      expect(body.profile.sharedGroups).toBe(0);
    });

    it("should return 'pending_sent' when current user sent a request", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query - current user is requester, status pending
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: "friendship-2",
            requester_id: currentUserId,
            status: "pending",
          }),
        ),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.friendshipStatus).toBe("pending_sent");
    });

    it("should return 'pending_received' when target user sent a request", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query - target user is requester, status pending
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: "friendship-3",
            requester_id: targetUserId,
            status: "pending",
          }),
        ),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.friendshipStatus).toBe("pending_received");
    });

    it("should return 'none' when no friendship exists", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query - no result
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.friendshipStatus).toBe("none");
    });
  });

  describe("shared groups", () => {
    it("should count shared groups correctly", async () => {
      const groupId1 = "group-1";
      const groupId2 = "group-2";

      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query - current user is in 2 groups
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess([{ group_id: groupId1 }, { group_id: groupId2 }]),
        ),
      );

      // 4. Target user's shared groups count
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 2 }),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.sharedGroups).toBe(2);
    });

    it("should return 0 shared groups when current user has no groups", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query - empty
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.sharedGroups).toBe(0);
    });

    it("should return 0 shared groups when no overlap", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([{ group_id: "group-1" }])),
      );

      // 4. Target user's shared groups count - no overlap
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 0 }),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.sharedGroups).toBe(0);
    });
  });

  describe("festival stats", () => {
    it("should include stats when festivalId is provided", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Festival stats query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            days_attended: 5,
            total_beers: 20,
            avg_beers: 4.0,
          }),
        ),
      );

      // 3. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 4. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId, `?festivalId=${festivalId}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.stats).toEqual({
        daysAttended: 5,
        totalBeers: 20,
        avgBeers: 4.0,
      });
    });

    it("should return null stats when no festivalId provided", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query (no stats query since no festivalId)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile.stats).toBeNull();
    });
  });

  describe("basic profile fields", () => {
    it("should return profile data with correct field mapping", async () => {
      // 1. Profile query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockProfileRow)),
      );

      // 2. Friendship query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // 3. My groups query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.profile).toMatchObject({
        id: targetUserId,
        username: "beermaster",
        fullName: "Hans Schmidt",
        avatarUrl: "avatars/hans.webp",
      });
    });

    it("should return 404 when profile not found", async () => {
      // 1. Profile query fails
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("No rows returned", "PGRST116")),
      );

      const res = await makeRequest(targetUserId);

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Not Found");
    });

    it("should validate UUID format for userId", async () => {
      const req = createAuthRequest("/profiles/not-a-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("authentication", () => {
    it("should require authentication", async () => {
      const req = new Request(`http://localhost/profiles/${targetUserId}`, {
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
