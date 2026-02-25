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
const PROFILE_ID = "623e4567-e89b-12d3-a456-426614174000";

const NOW = "2025-10-05T14:30:00.000Z";
const EARLIER = "2025-10-05T14:00:00.000Z";
const EVEN_EARLIER = "2025-10-05T13:30:00.000Z";

// ---------- Helpers ----------
function makeMockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: MESSAGE_ID,
    group_id: GROUP_ID,
    user_id: "test-user-id",
    content: "Hello group!",
    message_type: "message",
    pinned: false,
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
    it("should return messages for first page (pinned + regular)", async () => {
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
        // 2. Pinned messages
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([pinnedMsg])))
        // 3. Regular messages (limit+1 = 21, only 1 returned → hasMore=false)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([regularMsg])))
        // 4. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(2);
      // Pinned first, then regular
      expect(json.messages[0].pinned).toBe(true);
      expect(json.messages[0].content).toBe("Pinned announcement");
      expect(json.messages[1].pinned).toBe(false);
      expect(json.messages[1].content).toBe("Regular message");
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
      // Verify camelCase mapping
      expect(json.messages[0]).toHaveProperty("groupId");
      expect(json.messages[0]).toHaveProperty("userId");
      expect(json.messages[0]).toHaveProperty("messageType");
      expect(json.messages[0]).toHaveProperty("createdAt");
      expect(json.messages[0]).toHaveProperty("updatedAt");
      expect(json.messages[0]).toHaveProperty("username", "testuser");
      expect(json.messages[0]).toHaveProperty("fullName", "Test User");
      expect(json.messages[0]).toHaveProperty("avatarUrl");
    });

    it("should return only regular messages on subsequent pages (with cursor)", async () => {
      const regularMsg = makeMockMessage({
        content: "Older message",
        created_at: EVEN_EARLIER,
      });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Pinned messages (still fetched but not included when cursor present)
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              makeMockMessage({ pinned: true, content: "Pinned" }),
            ]),
          ),
        )
        // 3. Regular messages
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([regularMsg])))
        // 4. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages?limit=20&cursor=${EARLIER}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      // Only regular messages, no pinned on subsequent page
      expect(json.messages).toHaveLength(1);
      expect(json.messages[0].pinned).toBe(false);
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
    });

    it("should handle pagination with hasMore=true and nextCursor", async () => {
      // Create limit+1 messages (21 for limit=20) to trigger hasMore
      const messages = Array.from({ length: 21 }, (_, i) =>
        makeMockMessage({
          id: `d23e4567-e89b-12d3-a456-42661417${String(i).padStart(4, "0")}`,
          content: `Message ${i}`,
          created_at: `2025-10-05T14:${String(30 - i).padStart(2, "0")}:00.000Z`,
        }),
      );
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Pinned messages (none)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])))
        // 3. Regular messages (21 = limit+1 → hasMore=true)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(messages)))
        // 4. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      // Should only return 20, not 21
      expect(json.messages).toHaveLength(20);
      expect(json.hasMore).toBe(true);
      // nextCursor is created_at of the last returned message (index 19)
      expect(json.nextCursor).toBe(messages[19].created_at);
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check → null (not a member)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
      expect(json.error.message).toBe("You are not a member of this group");
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/groups/${GROUP_ID}/messages?limit=20`,
      );
      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when pinned messages query fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Pinned messages → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Database connection error")),
        );

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should return 500 when regular messages query fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Pinned messages → success
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])))
        // 3. Regular messages → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Query timeout")),
        );

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should return empty messages when no messages exist", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Pinned messages → empty
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])))
        // 3. Regular messages → empty
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])))
        // 4. Profiles → empty (no user IDs to look up)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages?limit=20`);
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(0);
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
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
    it("should return messages from all user groups for a festival", async () => {
      const message1 = makeMockMessage({
        id: "e23e4567-e89b-12d3-a456-426614174000",
        group_id: GROUP_ID,
        content: "Message in group 1",
        created_at: NOW,
      });
      const message2 = makeMockMessage({
        id: "f23e4567-e89b-12d3-a456-426614174000",
        group_id: GROUP_ID_2,
        user_id: OTHER_USER_ID,
        content: "Message in group 2",
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
                groups: {
                  id: GROUP_ID,
                  name: "Beer Buddies",
                  festival_id: FESTIVAL_ID,
                },
              },
              {
                group_id: GROUP_ID_2,
                groups: {
                  id: GROUP_ID_2,
                  name: "Prost Team",
                  festival_id: FESTIVAL_ID,
                },
              },
            ]),
          ),
        )
        // 2. Messages across all groups
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess([message1, message2])),
        )
        // 3. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profiles)));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(2);
      expect(json.messages[0].groupName).toBe("Beer Buddies");
      expect(json.messages[1].groupName).toBe("Prost Team");
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
      // Verify camelCase mapping
      expect(json.messages[0]).toHaveProperty("groupId");
      expect(json.messages[0]).toHaveProperty("userId");
      expect(json.messages[0]).toHaveProperty("messageType");
      expect(json.messages[0]).toHaveProperty("username", "testuser");
    });

    it("should return empty response when user has no groups", async () => {
      vi.mocked(mockSupabase.from)
        // 1. User group memberships → empty
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([])));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(0);
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
    });

    it("should return empty response when userGroups is null", async () => {
      vi.mocked(mockSupabase.from)
        // 1. User group memberships → null data
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(0);
      expect(json.hasMore).toBe(false);
      expect(json.nextCursor).toBeNull();
    });

    it("should handle pagination with hasMore=true", async () => {
      const messages = Array.from({ length: 21 }, (_, i) =>
        makeMockMessage({
          id: `f23e4567-e89b-12d3-a456-42661417${String(i).padStart(4, "0")}`,
          group_id: GROUP_ID,
          content: `Feed message ${i}`,
          created_at: `2025-10-05T14:${String(30 - i).padStart(2, "0")}:00.000Z`,
        }),
      );
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. User group memberships
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              {
                group_id: GROUP_ID,
                groups: {
                  id: GROUP_ID,
                  name: "Beer Buddies",
                  festival_id: FESTIVAL_ID,
                },
              },
            ]),
          ),
        )
        // 2. Messages (21 = limit+1)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(messages)))
        // 3. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(20);
      expect(json.hasMore).toBe(true);
      expect(json.nextCursor).toBe(messages[19].created_at);
    });

    it("should handle cursor-based pagination", async () => {
      const message = makeMockMessage({
        content: "Older feed message",
        created_at: EVEN_EARLIER,
      });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. User group memberships
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              {
                group_id: GROUP_ID,
                groups: {
                  id: GROUP_ID,
                  name: "Beer Buddies",
                  festival_id: FESTIVAL_ID,
                },
              },
            ]),
          ),
        )
        // 2. Messages with cursor filter
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([message])))
        // 3. Profiles
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess([profile])));

      const req = createAuthRequest(
        `/messages/feed?festivalId=${FESTIVAL_ID}&limit=20&cursor=${EARLIER}`,
      );
      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.messages).toHaveLength(1);
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
      vi.mocked(mockSupabase.from)
        // 1. User group memberships → error
        .mockReturnValueOnce(
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

    it("should return 500 when messages query fails", async () => {
      vi.mocked(mockSupabase.from)
        // 1. User group memberships
        .mockReturnValueOnce(
          createMockChain(
            mockSupabaseSuccess([
              {
                group_id: GROUP_ID,
                groups: {
                  id: GROUP_ID,
                  name: "Beer Buddies",
                  festival_id: FESTIVAL_ID,
                },
              },
            ]),
          ),
        )
        // 2. Messages → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Query timeout")),
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
  // POST /groups/:groupId/messages
  // =========================================================================
  describe("POST /groups/:groupId/messages", () => {
    it("should create a message successfully", async () => {
      const newMessage = makeMockMessage();
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert message (insert + select + single)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "Hello group!",
          messageType: "message",
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(json.message).toBeDefined();
      expect(json.message.content).toBe("Hello group!");
      expect(json.message.messageType).toBe("message");
      expect(json.message.groupId).toBe(GROUP_ID);
      expect(json.message.userId).toBe(mockUser.id);
      expect(json.message.username).toBe("testuser");
      expect(json.message.fullName).toBe("Test User");
      expect(json.message.avatarUrl).toBe("https://example.com/avatar.jpg");
    });

    it("should create an alert message", async () => {
      const newMessage = makeMockMessage({ message_type: "alert" });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert message
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "Important alert!",
          messageType: "alert",
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(json.message.messageType).toBe("alert");
    });

    it("should return 403 when user is not a group member", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Membership check → null (not a member)
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toBe("You are not a member of this group");
    });

    it("should require authentication", async () => {
      const req = new Request(`http://localhost/groups/${GROUP_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
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
        // 2. Insert → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Insert failed")),
        );

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
        }),
      });

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should validate groupId as UUID", async () => {
      const req = createAuthRequest("/groups/not-a-uuid/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "Hello!",
          messageType: "message",
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should handle null profile gracefully", async () => {
      const newMessage = makeMockMessage();

      vi.mocked(mockSupabase.from)
        // 1. Membership check
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
        )
        // 2. Insert message
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(newMessage)))
        // 3. Fetch profile → null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(`/groups/${GROUP_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "Hello group!",
          messageType: "message",
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
  // PUT /groups/:groupId/messages/:messageId
  // =========================================================================
  describe("PUT /groups/:groupId/messages/:messageId", () => {
    it("should update own message content successfully", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };
      const updatedMessage = makeMockMessage({
        content: "Updated content",
        updated_at: NOW,
      });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message (ownership check)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Update message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(updatedMessage)),
        )
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: "Updated content" }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.message).toBeDefined();
      expect(json.message.content).toBe("Updated content");
      expect(json.message.groupId).toBe(GROUP_ID);
      expect(json.message.username).toBe("testuser");
    });

    it("should update pinned state", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };
      const updatedMessage = makeMockMessage({ pinned: true });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Update message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(updatedMessage)),
        )
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ pinned: true }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.message.pinned).toBe(true);
    });

    it("should update messageType", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };
      const updatedMessage = makeMockMessage({ message_type: "alert" });
      const profile = makeMockProfile();

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Update message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(updatedMessage)),
        )
        // 3. Fetch profile
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(profile)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ messageType: "alert" }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.message.messageType).toBe("alert");
    });

    it("should return 404 when message does not exist", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message → null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: "Updated" }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.error.message).toBe("Message not found");
    });

    it("should return 403 when user is not the message author", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: OTHER_USER_ID, // Different user
        group_id: GROUP_ID,
      };

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message (belongs to different user)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        );

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: "Updated" }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toBe("You can only update your own messages");
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Updated" }),
        },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when update fails", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Update → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Update failed")),
        );

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: "Updated" }),
        },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should validate groupId and messageId as UUID", async () => {
      const req = createAuthRequest(
        "/groups/not-a-uuid/messages/also-not-uuid",
        {
          method: "PUT",
          body: JSON.stringify({ content: "Updated" }),
        },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // DELETE /groups/:groupId/messages/:messageId
  // =========================================================================
  describe("DELETE /groups/:groupId/messages/:messageId", () => {
    it("should delete own message successfully", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message (ownership check)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Delete message
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 404 when message does not exist", async () => {
      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message → null
        .mockReturnValueOnce(createMockChain(mockSupabaseSuccess(null)));

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.error.message).toBe("Message not found");
    });

    it("should return 403 when user is not the message author", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: OTHER_USER_ID, // Different user
        group_id: GROUP_ID,
      };

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message (belongs to different user)
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        );

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(json.error.message).toBe("You can only delete your own messages");
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should return 500 when delete fails", async () => {
      const existingMessage = {
        id: MESSAGE_ID,
        user_id: mockUser.id,
        group_id: GROUP_ID,
      };

      vi.mocked(mockSupabase.from)
        // 1. Fetch existing message
        .mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(existingMessage)),
        )
        // 2. Delete → error
        .mockReturnValueOnce(
          createMockChain(mockSupabaseError("Delete failed")),
        );

      const req = createAuthRequest(
        `/groups/${GROUP_ID}/messages/${MESSAGE_ID}`,
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);
      const json = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });

    it("should validate groupId and messageId as UUID", async () => {
      const req = createAuthRequest(
        "/groups/not-a-uuid/messages/also-not-uuid",
        { method: "DELETE" },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });
});
