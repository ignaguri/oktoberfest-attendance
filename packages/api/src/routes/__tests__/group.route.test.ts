import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import type { Group, GroupWithMembers } from "@prostcounter/shared";

import {
  createMockSupabase,
  mockSupabaseSuccess,
  mockSupabaseNotFound,
  createMockChain,
} from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import groupRoute from "../group.route";

describe("Group Routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Mock auth middleware by setting context directly - MUST come before route mounting
    // Mimics real auth middleware: require Authorization header for protected routes
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
    app.route("/", groupRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /groups", () => {
    it("should create group successfully", async () => {
      const mockGroup: Group = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festivalId: "223e4567-e89b-12d3-a456-426614174000",
        winningCriteria: "total_beers",
        inviteToken: "invite-token-abc",
        createdBy: mockUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // RPC response format (from create_group_with_member function)
      const mockRpcResponse = [
        {
          group_id: mockGroup.id,
          group_name: mockGroup.name,
          festival_id: mockGroup.festivalId,
          winning_criteria_id: 2, // total_beers = 2
          invite_token: mockGroup.inviteToken,
          created_by: mockGroup.createdBy,
          created_at: mockGroup.createdAt,
        },
      ];

      // Mock the RPC call for group creation
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: mockRpcResponse,
        error: null,
        count: null,
        status: 200,
        statusText: "OK",
      });

      const req = createAuthRequest("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Group",
          festivalId: "223e4567-e89b-12d3-a456-426614174000",
          winningCriteria: "total_beers",
        }),
      });

      const res = await app.request(req as Request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festivalId: "223e4567-e89b-12d3-a456-426614174000",
      });
    });

    it("should validate required fields", async () => {
      const req = createAuthRequest("/groups", {
        method: "POST",
        body: JSON.stringify({ name: "" }), // Invalid: empty name
      });

      const res = await app.request(req as Request);
      expect(res.status).toBe(400); // Validation error
    });

    it("should validate festival ID format", async () => {
      const req = createAuthRequest("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Group",
          festivalId: "not-a-uuid", // Invalid UUID
        }),
      });

      const res = await app.request(req as Request);
      expect(res.status).toBe(400);
    });

    it("should require authentication", async () => {
      // Create request without auth headers
      const req = new Request("http://localhost/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
        }),
      });

      const res = await app.request(req as Request);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /groups", () => {
    it("should list user groups", async () => {
      const mockGroupsDbRows = [
        {
          id: "323e4567-e89b-12d3-a456-426614174000",
          name: "Group 1",
          festival_id: "223e4567-e89b-12d3-a456-426614174000",
          winning_criteria_id: 2,
          invite_token: "token1",
          created_by: mockUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          winning_criteria: { id: 2, name: "total_beers" },
        },
        {
          id: "423e4567-e89b-12d3-a456-426614174000",
          name: "Group 2",
          festival_id: "223e4567-e89b-12d3-a456-426614174000",
          winning_criteria_id: 1,
          invite_token: "token2",
          created_by: "523e4567-e89b-12d3-a456-426614174000",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          winning_criteria: { id: 1, name: "days_attended" },
        },
      ];

      // Mock Supabase query chain: select().eq().eq().order()
      // Also need to mock member count queries for each group
      vi.mocked(mockSupabase.from)
        // 1. Main query: groups with winning_criteria join
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupsDbRows)),
        )
        // 2. Member count for Group 1
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 5 }),
        )
        // 3. Member count for Group 2
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 3 }),
        );

      const req = createAuthRequest(
        "/groups?festivalId=223e4567-e89b-12d3-a456-426614174000",
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as { data: GroupWithMembers[] };

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data[0]).toHaveProperty("memberCount");
    });

    it("should filter groups by festivalId", async () => {
      vi.mocked(mockSupabase.from)
        // Main query with no results
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(
        "/groups?festivalId=623e4567-e89b-12d3-a456-426614174000",
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
    });

    it("should require authentication", async () => {
      const req = new Request("http://localhost/groups");
      const res = await app.request(req as Request);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /groups/:id", () => {
    it("should get group details", async () => {
      const mockGroupDbRow = {
        id: "723e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festival_id: "223e4567-e89b-12d3-a456-426614174000",
        winning_criteria_id: 2,
        invite_token: "invite-token",
        created_by: mockUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        winning_criteria: { id: 2, name: "total_beers" },
      };

      vi.mocked(mockSupabase.from)
        // 1. findById: select().eq().single()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupDbRow)),
        )
        // 2. findById - member count: select().eq()
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 10 }),
        )
        // 3. isMember check: select().eq().eq().maybeSingle()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ id: "member-123" })),
        );

      const req = createAuthRequest(
        "/groups/723e4567-e89b-12d3-a456-426614174000",
      );
      const res = await app.request(req as Request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        id: "723e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        memberCount: 10,
      });
    });

    it("should return 404 for non-existent group", async () => {
      vi.mocked(mockSupabase.from)
        // 1. findById: returns not found (PGRST116)
        .mockReturnValueOnce(createMockChain(mockSupabaseNotFound()));

      const req = createAuthRequest(
        "/groups/823e4567-e89b-12d3-a456-426614174000",
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(404);
    });

    it("should validate group ID format", async () => {
      const req = createAuthRequest("/groups/invalid-uuid");
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /groups/:id/join", () => {
    it("should join group successfully", async () => {
      const mockGroupDbRow = {
        id: "923e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festival_id: "223e4567-e89b-12d3-a456-426614174000",
        winning_criteria_id: 2,
        invite_token: "valid-token",
        created_by: "023e4567-e89b-12d3-a456-426614174001",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        winning_criteria: { id: 2, name: "total_beers" },
      };

      vi.mocked(mockSupabase.from)
        // 1. joinGroup - findById: select().eq().single()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupDbRow)),
        )
        // 2. joinGroup - findById member count: select().eq()
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 0 }),
        )
        // 3. addMember - isMember check: select().eq().eq().maybeSingle()
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)))
        // 4. addMember - findById: select().eq().single()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupDbRow)),
        )
        // 5. addMember - findById member count: select().eq()
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 0 }),
        )
        // 6. addMember - insert: insert()
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess({})));

      const req = createAuthRequest(
        "/groups/923e4567-e89b-12d3-a456-426614174000/join",
        {
          method: "POST",
          body: JSON.stringify({ inviteToken: "valid-token" }),
        },
      );

      const res = await app.request(req as Request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("message");
    });

    it("should return 404 for non-existent group", async () => {
      vi.mocked(mockSupabase.from)
        // 1. joinGroup - findById: returns not found (PGRST116)
        .mockReturnValueOnce(createMockChain(mockSupabaseNotFound()));

      const req = createAuthRequest(
        "/groups/a23e4567-e89b-12d3-a456-426614174000/join",
        {
          method: "POST",
          body: JSON.stringify({ inviteToken: "invalid-token" }),
        },
      );

      const res = await app.request(req as Request);
      expect(res.status).toBe(404);
    });

    it("should validate group ID format", async () => {
      const req = createAuthRequest("/groups/invalid-uuid/join", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /groups/:id/leave", () => {
    it("should leave group successfully", async () => {
      const mockGroupDbRow = {
        id: "b23e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festival_id: "223e4567-e89b-12d3-a456-426614174000",
        winning_criteria_id: 2,
        invite_token: "token",
        created_by: "other-user-id",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        winning_criteria: { id: 2, name: "total_beers" },
      };

      vi.mocked(mockSupabase.from)
        // 1. leaveGroup - findById: select().eq().single()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupDbRow)),
        )
        // 2. leaveGroup - findById member count: select().eq()
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 5 }),
        )
        // 3. leaveGroup - isMember check: select().eq().eq().maybeSingle()
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess({
              id: "member-123",
              group_id: "b23e4567-e89b-12d3-a456-426614174000",
              user_id: mockUser.id,
            }),
          ),
        )
        // 4. removeMember: delete().eq().eq()
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess({})));

      const req = createAuthRequest(
        "/groups/b23e4567-e89b-12d3-a456-426614174000/leave",
        {
          method: "POST",
        },
      );

      const res = await app.request(req as Request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("success", true);
    });

    it("should return 404 when not a member", async () => {
      const mockGroupDbRow = {
        id: "c23e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festival_id: "223e4567-e89b-12d3-a456-426614174000",
        winning_criteria_id: 2,
        invite_token: "token",
        created_by: "other-user-id",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        winning_criteria: { id: 2, name: "total_beers" },
      };

      vi.mocked(mockSupabase.from)
        // 1. leaveGroup - findById: select().eq().single()
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockGroupDbRow)),
        )
        // 2. leaveGroup - findById member count: select().eq()
        .mockReturnValueOnce(
          createMockChain({ ...mockSupabaseSuccess(null), count: 5 }),
        )
        // 3. leaveGroup - isMember check: returns null (not a member)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        "/groups/c23e4567-e89b-12d3-a456-426614174000/leave",
        {
          method: "POST",
        },
      );

      const res = await app.request(req as Request);
      expect(res.status).toBe(403); // ForbiddenError when not a member
    });
  });
});
