import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import {
  createMockSupabase,
  mockSupabaseSuccess,
  mockSupabaseError,
} from "../../__tests__/helpers/mock-supabase";
import groupRoute from "../group.route";
import type { Group, GroupWithMembers } from "@prostcounter/shared";

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
        return c.json({ error: "Unauthorized", message: "Missing authorization header" }, 401);
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

      // Database row format (snake_case keys)
      const mockGroupDbRow = {
        id: mockGroup.id,
        name: mockGroup.name,
        festival_id: mockGroup.festivalId,
        winning_criteria_id: 2, // total_beers = 2
        invite_token: mockGroup.inviteToken,
        created_by: mockGroup.createdBy,
        created_at: mockGroup.createdAt,
        updated_at: mockGroup.updatedAt,
        winning_criteria: { id: 2, name: "total_beers" },
      };

      // Mock Supabase responses for the complete group creation flow
      vi.mocked(mockSupabase.from)
        // 1. Insert group into "groups" table
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(mockSupabaseSuccess(mockGroupDbRow)),
            }),
          }),
        } as any)
        // 2. Check if user is already a member (isMember on "group_members")
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
              }),
            }),
          }),
        } as any)
        // 3. Get group details (findById on "groups")
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(mockSupabaseSuccess(mockGroupDbRow)),
            }),
          }),
        } as any)
        // 4. Get member count (in findById on "group_members")
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        } as any)
        // 5. Insert member into "group_members"
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue(mockSupabaseSuccess({})),
        } as any);

      const req = createAuthRequest("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Group",
          festivalId: "223e4567-e89b-12d3-a456-426614174000",
          winningCriteria: "total_beers",
        }),
      });

      const res = await app.request(req);
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

      const res = await app.request(req);
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

      const res = await app.request(req);
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

      const res = await app.request(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /groups", () => {
    it("should list user groups", async () => {
      const mockGroups: GroupWithMembers[] = [
        {
          id: "323e4567-e89b-12d3-a456-426614174000",
          name: "Group 1",
          festivalId: "223e4567-e89b-12d3-a456-426614174000",
          winningCriteria: "total_beers",
          inviteToken: "token1",
          createdBy: mockUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          memberCount: 5,
        },
        {
          id: "423e4567-e89b-12d3-a456-426614174000",
          name: "Group 2",
          festivalId: "223e4567-e89b-12d3-a456-426614174000",
          winningCriteria: "days_attended",
          inviteToken: "token2",
          createdBy: "523e4567-e89b-12d3-a456-426614174000",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          memberCount: 3,
        },
      ];

      // Mock Supabase query
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockSupabaseSuccess(mockGroups)),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups?festivalId=223e4567-e89b-12d3-a456-426614174000");
      const res = await app.request(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data[0]).toHaveProperty("memberCount");
    });

    it("should filter groups by festivalId", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockSupabaseSuccess([])),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups?festivalId=623e4567-e89b-12d3-a456-426614174000");
      const res = await app.request(req);

      expect(res.status).toBe(200);
      expect(mockFrom).toHaveBeenCalled();
    });

    it("should require authentication", async () => {
      const req = new Request("http://localhost/groups");
      const res = await app.request(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /groups/:id", () => {
    it("should get group details", async () => {
      const mockGroup: GroupWithMembers = {
        id: "723e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        festivalId: "223e4567-e89b-12d3-a456-426614174000",
        winningCriteria: "total_beers",
        inviteToken: "invite-token",
        createdBy: mockUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberCount: 10,
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockSupabaseSuccess(mockGroup)),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/723e4567-e89b-12d3-a456-426614174000");
      const res = await app.request(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        id: "723e4567-e89b-12d3-a456-426614174000",
        name: "Test Group",
        memberCount: 10,
      });
    });

    it("should return 404 for non-existent group", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue(mockSupabaseError("Group not found")),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/823e4567-e89b-12d3-a456-426614174000");
      const res = await app.request(req);

      expect(res.status).toBe(404);
    });

    it("should validate group ID format", async () => {
      const req = createAuthRequest("/groups/invalid-uuid");
      const res = await app.request(req);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /groups/:id/join", () => {
    it("should join group successfully", async () => {
      // Mock successful join operation
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              mockSupabaseSuccess({
                id: "923e4567-e89b-12d3-a456-426614174000",
                name: "Test Group",
                festivalId: "223e4567-e89b-12d3-a456-426614174000",
                winningCriteria: "total_beers",
                inviteToken: "valid-token",
                createdBy: "023e4567-e89b-12d3-a456-426614174001",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
            ),
          }),
        }),
        insert: vi.fn().mockResolvedValue(mockSupabaseSuccess({})),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/923e4567-e89b-12d3-a456-426614174000/join", {
        method: "POST",
        body: JSON.stringify({ inviteToken: "valid-token" }),
      });

      const res = await app.request(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("message");
    });

    it("should return 404 for non-existent group", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue(mockSupabaseError("Group not found")),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/a23e4567-e89b-12d3-a456-426614174000/join", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await app.request(req);
      expect(res.status).toBe(404);
    });

    it("should validate group ID format", async () => {
      const req = createAuthRequest("/groups/invalid-uuid/join", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /groups/:id/leave", () => {
    it("should leave group successfully", async () => {
      // Mock checking membership
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              mockSupabaseSuccess({
                group_id: "b23e4567-e89b-12d3-a456-426614174000",
                user_id: mockUser.id,
              }),
            ),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockSupabaseSuccess({})),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/b23e4567-e89b-12d3-a456-426614174000/leave", {
        method: "POST",
      });

      const res = await app.request(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("success", true);
    });

    it("should return 404 when not a member", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const req = createAuthRequest("/groups/c23e4567-e89b-12d3-a456-426614174000/leave", {
        method: "POST",
      });

      const res = await app.request(req);
      expect(res.status).toBe(404);
    });
  });
});
