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
import groupMessageRoute from "../group-message.route";

// ---------- Constants ----------
const GROUP_ID = "123e4567-e89b-12d3-a456-426614174000";
const GROUP_ID_2 = "223e4567-e89b-12d3-a456-426614174000";
const MESSAGE_ID = "323e4567-e89b-12d3-a456-426614174000";
const OTHER_USER_ID = "423e4567-e89b-12d3-a456-426614174000";
const FESTIVAL_ID = "523e4567-e89b-12d3-a456-426614174000";

const NOW = "2025-10-05T14:30:00.000Z";
const EARLIER = "2025-10-05T14:00:00.000Z";

// ---------- Helpers ----------
function makeMockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: MESSAGE_ID,
    user_id: "test-user-id",
    content: "Hello group!",
    message_type: "message",
    pinned: false,
    visibility: "groups",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-user-id",
    username: "testuser",
    full_name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    ...overrides,
  };
}

describe("Group Message Routes", () => {
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

    app.route("/", groupMessageRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /groups/:groupId/messages
  // =========================================================================
  describe("GET /groups/:groupId/messages", () => {
    it("should return messages from group members (pinned + regular)", async () => {
      const pinnedMsg = makeMockMessage({
        id: "a23e4567-e89b-12d3-a456-426614174000",
        pinned: true,
        content: "Pinned announcement",
        created_at: EARLIER,
      });
      const regularMsg = makeMockMessage({
        id: "b23e4567-e89b-12d3-a456-426614174000",
        content: "Regular message",
        created_at: NOW,
      });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Group lookup (festival_id)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ festival_id: FESTIVAL_ID })),
        )
        // 3. Group members
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess([{ user_id: mockUser.id }])),
        )
        // 4. Pinned messages
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([pinnedMsg])))
        // 5. Regular messages (limit+1 = 21, only 1 returned → hasMore=false)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([regularMsg])))
        // 6. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(2);
      expect(json.messages[0].pinned).toBe(true);
      expect(json.messages[0].content).toBe("Pinned announcement");
      expect(json.messages[1].pinned).toBe(false);
      expect(json.messages[1].content).toBe("Regular message");
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
      // Verify camelCase mapping
      expect(json.messages[0]).toHaveProperty("userId");
      expect(json.messages[0]).toHaveProperty("messageType");
      expect(json.messages[0]).toHaveProperty("visibility", "groups");
      expect(json.messages[0]).toHaveProperty("createdAt");
      expect(json.messages[0]).toHaveProperty("username", "testuser");
      expect(json.messages[0]).toHaveProperty("fullName", "Test User");
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/groups/${GROUP_ID}/messages?limit=20`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should validate groupId as UUID", async () => {
      const req = createAuthRequest("/groups/not-a-uuid/messages?limit=20");
      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /messages/feed
  // =========================================================================
  describe("GET /messages/feed", () => {
    it("should return messages from co-members for a festival", async () => {
      const message1 = makeMockMessage({
        id: "e23e4567-e89b-12d3-a456-426614174000",
        content: "Message from user 1",
        created_at: NOW,
      });
      const message2 = makeMockMessage({
        id: "f23e4567-e89b-12d3-a456-426614174000",
        user_id: OTHER_USER_ID,
        content: "Message from user 2",
        created_at: EARLIER,
      });
      const profiles = [
        makeMockProfile(),
        makeMockProfile({
          id: OTHER_USER_ID,
          username: "otheruser",
          full_name: "Other User",
        }),
      ];

      vi.mocked(mockSupabase.from)
        // 1. User group memberships
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              {
                group_id: GROUP_ID,
                groups: { id: GROUP_ID, festival_id: FESTIVAL_ID },
              },
              {
                group_id: GROUP_ID_2,
                groups: { id: GROUP_ID_2, festival_id: FESTIVAL_ID },
              },
            ]),
          ),
        )
        // 2. Co-members
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              { user_id: mockUser.id },
              { user_id: OTHER_USER_ID },
            ]),
          ),
        )
        // 3. Messages
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess([message1, message2])),
        )
        // 4. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profiles)));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(2);
      expect(json.messages[0]).toHaveProperty("userId");
      expect(json.messages[0]).toHaveProperty("visibility", "groups");
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
    });

    it("should return empty response when user has no groups", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(0);
      expect(json.hasMore).toBe(false);
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when groups query fails", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Database connection error")),
      );

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /messages
  // =========================================================================
  describe("POST /messages", () => {
    it("should create a message successfully", async () => {
      const newMessage = makeMockMessage();
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check (any group in festival)
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess({
              group_id: GROUP_ID,
              groups: { id: GROUP_ID, festival_id: FESTIVAL_ID },
            }),
          ),
        )
        // 2. Insert message
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Hello group!",
          messageType: "message",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(json.message).toBeDefined();
      expect(json.message.content).toBe("Hello group!");
      expect(json.message.messageType).toBe("message");
      expect(json.message.visibility).toBe("groups");
      expect(json.message.userId).toBe(mockUser.id);
      expect(json.message.username).toBe("testuser");
    });

    it("should create an alert message", async () => {
      const newMessage = makeMockMessage({ message_type: "alert" });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess({
              group_id: GROUP_ID,
              groups: { id: GROUP_ID, festival_id: FESTIVAL_ID },
            }),
          ),
        )
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Important alert!",
          messageType: "alert",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(json.message.messageType).toBe("alert");
    });

    it("should return 403 when user has no groups in the festival", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      const req = createAuthRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toContain("must be a member");
    });

    it("should require authentication", async () => {
      const req = new Request("http://localhost/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when insert fails", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess({
              group_id: GROUP_ID,
              groups: { id: GROUP_ID, festival_id: FESTIVAL_ID },
            }),
          ),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Insert failed")),
        );

      const req = createAuthRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should handle null profile gracefully", async () => {
      const newMessage = makeMockMessage();

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess({
              group_id: GROUP_ID,
              groups: { id: GROUP_ID, festival_id: FESTIVAL_ID },
            }),
          ),
        )
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Hello group!",
          messageType: "message",
          festivalId: FESTIVAL_ID,
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(json.message.username).toBeNull();
      expect(json.message.fullName).toBeNull();
      expect(json.message.avatarUrl).toBeNull();
    });
  });

  // =========================================================================
  // PUT /messages/:messageId
  // =========================================================================
  describe("PUT /messages/:messageId", () => {
    it("should update own message content successfully", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: mockUser.id };
      const updatedMessage = makeMockMessage({
        content: "Updated content",
        updated_at: NOW,
      });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(updatedMessage)),
        )
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "PUT",
        body: JSON.stringify({ content: "Updated content" }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.message).toBeDefined();
      expect(json.message.content).toBe("Updated content");
      expect(json.message.username).toBe("testuser");
    });

    it("should update pinned state", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: mockUser.id };
      const updatedMessage = makeMockMessage({ pinned: true });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(updatedMessage)),
        )
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "PUT",
        body: JSON.stringify({ pinned: true }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.message.pinned).toBe(true);
    });

    it("should return 404 when message does not exist", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "PUT",
        body: JSON.stringify({ content: "Updated" }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.error.message).toBe("Message not found");
    });

    it("should return 403 when user is not the message author", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: OTHER_USER_ID };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(existingMessage)),
      );

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "PUT",
        body: JSON.stringify({ content: "Updated" }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toBe("You can only update your own messages");
    });

    it("should require authentication", async () => {
      const req = new Request(`http://localhost/messages/${MESSAGE_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should validate messageId as UUID", async () => {
      const req = createAuthRequest("/messages/not-a-uuid", {
        method: "PUT",
        body: JSON.stringify({ content: "Updated" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // DELETE /messages/:messageId
  // =========================================================================
  describe("DELETE /messages/:messageId", () => {
    it("should delete own message successfully", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: mockUser.id };

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "DELETE",
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 404 when message does not exist", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "DELETE",
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.error.message).toBe("Message not found");
    });

    it("should return 403 when user is not the message author", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: OTHER_USER_ID };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(existingMessage)),
      );

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "DELETE",
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toBe("You can only delete your own messages");
    });

    it("should require authentication", async () => {
      const req = new Request(`http://localhost/messages/${MESSAGE_ID}`, {
        method: "DELETE",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should validate messageId as UUID", async () => {
      const req = createAuthRequest("/messages/not-a-uuid", {
        method: "DELETE",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should return 500 when delete fails", async () => {
      const existingMessage = { id: MESSAGE_ID, user_id: mockUser.id };

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Delete failed")),
        );

      const req = createAuthRequest(`/messages/${MESSAGE_ID}`, {
        method: "DELETE",
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });
  });
});
