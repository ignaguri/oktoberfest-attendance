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
import photoSocialRoute from "../photo-social.route";

// Test constants
const PHOTO_ID = "123e4567-e89b-12d3-a456-426614174000";
const GROUP_ID = "223e4567-e89b-12d3-a456-426614174000";
const COMMENT_ID = "323e4567-e89b-12d3-a456-426614174000";
const OTHER_USER_ID = "423e4567-e89b-12d3-a456-426614174000";

describe("Photo Social Routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

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

    app.route("/", photoSocialRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===== GET /photos/:photoId/reactions =====
  describe("GET /photos/:photoId/reactions", () => {
    it("should return aggregated reactions with user profiles", async () => {
      const mockReactions = [
        {
          emoji: "🍺",
          user_id: mockUser.id,
          profiles: {
            username: "testuser",
            avatar_url: "https://example.com/avatar1.jpg",
          },
        },
        {
          emoji: "🍺",
          user_id: OTHER_USER_ID,
          profiles: {
            username: "otheruser",
            avatar_url: "https://example.com/avatar2.jpg",
          },
        },
        {
          emoji: "🎉",
          user_id: OTHER_USER_ID,
          profiles: {
            username: "otheruser",
            avatar_url: "https://example.com/avatar2.jpg",
          },
        },
      ];

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch reactions
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockReactions)),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("reactions");
      expect(json).toHaveProperty("userReactions");

      // Should have 2 emoji groups
      expect(json.reactions).toHaveLength(2);

      // Beer emoji should have count 2
      const beerReaction = json.reactions.find((r: any) => r.emoji === "🍺");
      expect(beerReaction).toBeDefined();
      expect(beerReaction.count).toBe(2);
      expect(beerReaction.users).toHaveLength(2);

      // Party emoji should have count 1
      const partyReaction = json.reactions.find((r: any) => r.emoji === "🎉");
      expect(partyReaction).toBeDefined();
      expect(partyReaction.count).toBe(1);

      // Current user reacted with beer emoji
      expect(json.userReactions).toContain("🍺");
      expect(json.userReactions).not.toContain("🎉");
    });

    it("should return empty reactions when none exist", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch reactions - empty
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.reactions).toHaveLength(0);
      expect(json.userReactions).toHaveLength(0);
    });

    it("should track current user reactions correctly", async () => {
      const mockReactions = [
        {
          emoji: "🍺",
          user_id: mockUser.id,
          profiles: { username: "testuser", avatar_url: null },
        },
        {
          emoji: "🎉",
          user_id: mockUser.id,
          profiles: { username: "testuser", avatar_url: null },
        },
        {
          emoji: "❤️",
          user_id: OTHER_USER_ID,
          profiles: { username: "otheruser", avatar_url: null },
        },
      ];

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockReactions)),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.userReactions).toHaveLength(2);
      expect(json.userReactions).toContain("🍺");
      expect(json.userReactions).toContain("🎉");
      expect(json.userReactions).not.toContain("❤️");
    });

    it("should handle profiles as array (Supabase join variant)", async () => {
      const mockReactions = [
        {
          emoji: "🍺",
          user_id: mockUser.id,
          profiles: [{ username: "testuser", avatar_url: null }],
        },
      ];

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockReactions)),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.reactions[0].users[0].username).toBe("testuser");
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // Membership check returns null (not a member)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBe("FORBIDDEN");
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(
        `http://localhost/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when database query fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check succeeds
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch reactions fails
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Database connection error")),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest(
        `/photos/invalid-uuid/reactions?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // ===== POST /photos/:photoId/reactions =====
  describe("POST /photos/:photoId/reactions", () => {
    it("should add a reaction successfully", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert reaction
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "POST",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 409 when reaction already exists (unique constraint)", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert fails with unique constraint violation
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseError(
              "duplicate key value violates unique constraint",
              "23505",
            ),
          ),
        );

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "POST",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(409);
      expect(json.error).toBe("CONFLICT");
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // Membership check returns null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "POST",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBe("FORBIDDEN");
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(`http://localhost/photos/${PHOTO_ID}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when insert fails with non-constraint error", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert fails with generic error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Connection refused")),
        );

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "POST",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest("/photos/invalid-uuid/reactions", {
        method: "POST",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // ===== DELETE /photos/:photoId/reactions =====
  describe("DELETE /photos/:photoId/reactions", () => {
    it("should remove a reaction successfully", async () => {
      vi.mocked(mockSupabase.from)
        // Delete reaction
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "DELETE",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(`http://localhost/photos/${PHOTO_ID}/reactions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when delete fails", async () => {
      vi.mocked(mockSupabase.from)
        // Delete fails
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Database error")),
        );

      const req = createAuthRequest(`/photos/${PHOTO_ID}/reactions`, {
        method: "DELETE",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest("/photos/invalid-uuid/reactions", {
        method: "DELETE",
        body: JSON.stringify({ groupId: GROUP_ID, emoji: "🍺" }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // ===== GET /photos/:photoId/comments =====
  describe("GET /photos/:photoId/comments", () => {
    it("should return formatted comments with user profiles", async () => {
      const mockComments = [
        {
          id: COMMENT_ID,
          user_id: mockUser.id,
          content: "Great photo!",
          created_at: "2024-09-21T14:00:00Z",
          profiles: {
            username: "testuser",
            avatar_url: "https://example.com/avatar1.jpg",
          },
        },
        {
          id: "523e4567-e89b-12d3-a456-426614174000",
          user_id: OTHER_USER_ID,
          content: "Prost!",
          created_at: "2024-09-21T14:05:00Z",
          profiles: { username: "otheruser", avatar_url: null },
        },
      ];

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch comments
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockComments)),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("comments");
      expect(json.comments).toHaveLength(2);

      // Check first comment formatting
      expect(json.comments[0]).toMatchObject({
        id: COMMENT_ID,
        userId: mockUser.id,
        username: "testuser",
        avatarUrl: "https://example.com/avatar1.jpg",
        content: "Great photo!",
        createdAt: "2024-09-21T14:00:00Z",
      });

      // Check second comment with null avatar
      expect(json.comments[1]).toMatchObject({
        userId: OTHER_USER_ID,
        username: "otheruser",
        avatarUrl: null,
        content: "Prost!",
      });
    });

    it("should return empty comments list when none exist", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch comments - empty
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.comments).toHaveLength(0);
    });

    it("should handle profiles as array (Supabase join variant)", async () => {
      const mockComments = [
        {
          id: COMMENT_ID,
          user_id: mockUser.id,
          content: "Nice one!",
          created_at: "2024-09-21T14:00:00Z",
          profiles: [{ username: "testuser", avatar_url: null }],
        },
      ];

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockComments)),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.comments[0].username).toBe("testuser");
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // Membership check returns null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBe("FORBIDDEN");
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(
        `http://localhost/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when database query fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check succeeds
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Fetch comments fails
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Database connection error")),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest(
        `/photos/invalid-uuid/comments?groupId=${GROUP_ID}`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // ===== POST /photos/:photoId/comments =====
  describe("POST /photos/:photoId/comments", () => {
    it("should add a comment successfully", async () => {
      const mockComment = {
        id: COMMENT_ID,
        content: "Great photo!",
        created_at: "2024-09-21T14:00:00Z",
      };

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert comment
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(mockComment)));

      const req = createAuthRequest(`/photos/${PHOTO_ID}/comments`, {
        method: "POST",
        body: JSON.stringify({
          groupId: GROUP_ID,
          content: "Great photo!",
        }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("comment");
      expect(json.comment).toMatchObject({
        id: COMMENT_ID,
        content: "Great photo!",
        createdAt: "2024-09-21T14:00:00Z",
      });
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // Membership check returns null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/photos/${PHOTO_ID}/comments`, {
        method: "POST",
        body: JSON.stringify({
          groupId: GROUP_ID,
          content: "Nice!",
        }),
      });
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBe("FORBIDDEN");
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(`http://localhost/photos/${PHOTO_ID}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: GROUP_ID,
          content: "Nice!",
        }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when insert fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert fails
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Insert failed")),
        );

      const req = createAuthRequest(`/photos/${PHOTO_ID}/comments`, {
        method: "POST",
        body: JSON.stringify({
          groupId: GROUP_ID,
          content: "Nice!",
        }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest("/photos/invalid-uuid/comments", {
        method: "POST",
        body: JSON.stringify({
          groupId: GROUP_ID,
          content: "Nice!",
        }),
      });
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // ===== DELETE /photos/:photoId/comments/:commentId =====
  describe("DELETE /photos/:photoId/comments/:commentId", () => {
    it("should delete own comment successfully", async () => {
      vi.mocked(mockSupabase.from)
        // Delete with count: "exact" returns count=1
        .mockReturnValueOnce(
          createMockChain({ data: null, error: null, count: 1 }),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments/${COMMENT_ID}`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 404 when comment not found or not owned by user", async () => {
      vi.mocked(mockSupabase.from)
        // Delete with count: "exact" returns count=0
        .mockReturnValueOnce(
          createMockChain({ data: null, error: null, count: 0 }),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments/${COMMENT_ID}`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.error).toBe("NOT_FOUND");
    });

    it("should return 401 when not authenticated", async () => {
      const req = new Request(
        `http://localhost/photos/${PHOTO_ID}/comments/${COMMENT_ID}`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when delete fails", async () => {
      vi.mocked(mockSupabase.from)
        // Delete fails with error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Database error")),
        );

      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments/${COMMENT_ID}`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
    });

    it("should return 400 for invalid photoId format", async () => {
      const req = createAuthRequest(
        `/photos/invalid-uuid/comments/${COMMENT_ID}`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid commentId format", async () => {
      const req = createAuthRequest(
        `/photos/${PHOTO_ID}/comments/invalid-uuid`,
        {
          method: "DELETE",
        },
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });
});
