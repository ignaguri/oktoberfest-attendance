import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateMessageResponseSchema,
  CreateMessageSchema,
  DeleteGroupMessageResponseSchema,
  GetGroupMessagesQuerySchema,
  GetGroupMessagesResponseSchema,
  GetMessageFeedQuerySchema,
  GetMessageFeedResponseSchema,
  GroupMessageGroupIdParamSchema,
  MessageIdParamSchema,
  UpdateGroupMessageResponseSchema,
  UpdateGroupMessageSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { ForbiddenError, NotFoundError } from "../middleware/error";

// Create router
const app = new OpenAPIHono<AuthContext>();

// Helper: map a raw DB message row + profile to the API response shape
function mapMessageResponse(
  m: {
    id: string;
    user_id: string;
    content: string;
    message_type: string;
    pinned: boolean;
    visibility: string;
    created_at: string;
    updated_at: string;
  },
  profile?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null,
) {
  return {
    id: m.id,
    userId: m.user_id,
    username: profile?.username ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    content: m.content,
    messageType: m.message_type as "message" | "alert",
    pinned: m.pinned,
    visibility: m.visibility as "groups" | "public",
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

// -------------------------------------------------------------------
// GET /groups/:groupId/messages - List messages from group members
// -------------------------------------------------------------------
const listGroupMessagesRoute = createRoute({
  method: "get",
  path: "/groups/{groupId}/messages",
  tags: ["group-messages"],
  summary: "List messages from group members",
  description:
    "Returns messages posted by members of this group, with cursor-based pagination. Pinned messages come first.",
  request: {
    params: GroupMessageGroupIdParamSchema,
    query: GetGroupMessagesQuerySchema,
  },
  responses: {
    200: {
      description: "Messages retrieved successfully",
      content: {
        "application/json": {
          schema: GetGroupMessagesResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    403: {
      description: "Forbidden - Not a group member",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listGroupMessagesRoute, async (c) => {
  const { supabase, user } = c.var;
  const { groupId } = c.req.valid("param");
  const { limit, cursor } = c.req.valid("query");

  // Check membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    throw new ForbiddenError("You are not a member of this group");
  }

  // Get group's festival_id and all member user IDs
  const { data: group } = await supabase
    .from("groups")
    .select("festival_id")
    .eq("id", groupId)
    .single();

  if (!group) {
    throw new NotFoundError("Group not found");
  }

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  const memberIds = (members || []).map((m) => m.user_id);

  if (memberIds.length === 0) {
    return c.json({ messages: [], nextCursor: null, hasMore: false }, 200);
  }

  const messageSelect = `
    id,
    user_id,
    content,
    message_type,
    pinned,
    visibility,
    created_at,
    updated_at
  `;

  // Fetch pinned messages first (always shown at top)
  const { data: pinnedMessages, error: pinnedError } = await supabase
    .from("group_messages")
    .select(messageSelect)
    .eq("festival_id", group.festival_id)
    .in("user_id", memberIds)
    .eq("pinned", true)
    .order("created_at", { ascending: false });

  if (pinnedError) {
    throw new Error(`Failed to fetch pinned messages: ${pinnedError.message}`);
  }

  // Fetch non-pinned messages with pagination
  let query = supabase
    .from("group_messages")
    .select(messageSelect)
    .eq("festival_id", group.festival_id)
    .in("user_id", memberIds)
    .eq("pinned", false)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: regularMessages, error: regularError } = await query;

  if (regularError) {
    throw new Error(`Failed to fetch messages: ${regularError.message}`);
  }

  // Determine pagination
  const hasMore = regularMessages.length > limit;
  const resultMessages = hasMore
    ? regularMessages.slice(0, limit)
    : regularMessages;

  const nextCursor =
    hasMore && resultMessages.length > 0
      ? resultMessages[resultMessages.length - 1].created_at
      : null;

  // Combine pinned + regular (only include pinned on first page)
  const allMessages = cursor
    ? resultMessages
    : [...(pinnedMessages || []), ...resultMessages];

  // Collect user IDs to fetch profiles
  const userIds = [...new Set(allMessages.map((m) => m.user_id))];

  // Fetch user profiles
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds)
      : { data: [] };

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const messages = allMessages.map((m) =>
    mapMessageResponse(m, profileMap.get(m.user_id)),
  );

  return c.json({ messages, nextCursor, hasMore }, 200);
});

// -------------------------------------------------------------------
// GET /messages/feed - Get messages from co-members across groups
// -------------------------------------------------------------------
const getMessageFeedRoute = createRoute({
  method: "get",
  path: "/messages/feed",
  tags: ["group-messages"],
  summary: "Get message feed across all groups",
  description:
    "Returns recent messages from users who share groups with the current user for a given festival",
  request: {
    query: GetMessageFeedQuerySchema,
  },
  responses: {
    200: {
      description: "Message feed retrieved successfully",
      content: {
        "application/json": {
          schema: GetMessageFeedResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getMessageFeedRoute, async (c) => {
  const { supabase, user } = c.var;
  const { festivalId, limit, cursor } = c.req.valid("query");

  // Get user's group IDs for this festival
  const { data: userGroups, error: groupsError } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(id, festival_id)")
    .eq("user_id", user.id)
    .eq("groups.festival_id", festivalId);

  if (groupsError) {
    throw new Error(`Failed to fetch user groups: ${groupsError.message}`);
  }

  if (!userGroups || userGroups.length === 0) {
    return c.json({ messages: [], nextCursor: null, hasMore: false }, 200);
  }

  const groupIds = userGroups.map((g) => g.group_id);

  // Get all co-member user IDs (users who share groups with current user)
  const { data: coMembers } = await supabase
    .from("group_members")
    .select("user_id")
    .in("group_id", groupIds);

  const coMemberIds = [...new Set((coMembers || []).map((m) => m.user_id))];

  if (coMemberIds.length === 0) {
    return c.json({ messages: [], nextCursor: null, hasMore: false }, 200);
  }

  const messageSelect = `
    id,
    user_id,
    content,
    message_type,
    pinned,
    visibility,
    created_at,
    updated_at
  `;

  // Fetch messages from co-members in this festival
  let query = supabase
    .from("group_messages")
    .select(messageSelect)
    .eq("festival_id", festivalId)
    .in("user_id", coMemberIds)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: messages, error: messagesError } = await query;

  if (messagesError) {
    throw new Error(`Failed to fetch message feed: ${messagesError.message}`);
  }

  // Determine pagination
  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  const nextCursor =
    hasMore && resultMessages.length > 0
      ? resultMessages[resultMessages.length - 1].created_at
      : null;

  // Collect user IDs to fetch profiles
  const userIds = [...new Set(resultMessages.map((m) => m.user_id))];

  // Fetch user profiles
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds)
      : { data: [] };

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const feedMessages = resultMessages.map((m) =>
    mapMessageResponse(m, profileMap.get(m.user_id)),
  );

  return c.json({ messages: feedMessages, nextCursor, hasMore }, 200);
});

// -------------------------------------------------------------------
// POST /messages - Post a new message (visible to all user's groups)
// -------------------------------------------------------------------
const createMessageRoute = createRoute({
  method: "post",
  path: "/messages",
  tags: ["group-messages"],
  summary: "Post a new message",
  description:
    "Create a new message visible to all groups the user belongs to in the given festival",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateMessageSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Message created successfully",
      content: {
        "application/json": {
          schema: CreateMessageResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    403: {
      description: "Forbidden - Not a member of any group in this festival",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(createMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { content, messageType, festivalId } = c.req.valid("json");

  // Verify user is member of at least one group in this festival
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(id, festival_id)")
    .eq("user_id", user.id)
    .eq("groups.festival_id", festivalId)
    .limit(1)
    .single();

  if (!membership) {
    throw new ForbiddenError(
      "You must be a member of at least one group in this festival to post messages",
    );
  }

  // Insert message
  const { data: newMessage, error } = await supabase
    .from("group_messages")
    .insert({
      user_id: user.id,
      festival_id: festivalId,
      content,
      message_type: messageType,
    })
    .select(
      `
      id,
      user_id,
      content,
      message_type,
      pinned,
      visibility,
      created_at,
      updated_at
    `,
    )
    .single();

  if (error || !newMessage) {
    throw new Error(`Failed to create message: ${error?.message}`);
  }

  // Fetch profile for response
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const message = mapMessageResponse(newMessage, profile);

  return c.json({ message }, 201);
});

// -------------------------------------------------------------------
// PUT /messages/:messageId - Update own message
// -------------------------------------------------------------------
const updateMessageRoute = createRoute({
  method: "put",
  path: "/messages/{messageId}",
  tags: ["group-messages"],
  summary: "Update own message",
  description:
    "Update the content, type, or pinned state of a message you posted",
  request: {
    params: MessageIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateGroupMessageSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Message updated successfully",
      content: {
        "application/json": {
          schema: UpdateGroupMessageResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    403: {
      description: "Forbidden - Not the message author",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    404: {
      description: "Message not found",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { messageId } = c.req.valid("param");
  const updates = c.req.valid("json");

  // Check message exists and belongs to user
  const { data: existing } = await supabase
    .from("group_messages")
    .select("id, user_id")
    .eq("id", messageId)
    .single();

  if (!existing) {
    throw new NotFoundError("Message not found");
  }

  if (existing.user_id !== user.id) {
    throw new ForbiddenError("You can only update your own messages");
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.messageType !== undefined)
    updateData.message_type = updates.messageType;
  if (updates.pinned !== undefined) updateData.pinned = updates.pinned;

  const { data: updated, error } = await supabase
    .from("group_messages")
    .update(updateData)
    .eq("id", messageId)
    .select(
      `
      id,
      user_id,
      content,
      message_type,
      pinned,
      visibility,
      created_at,
      updated_at
    `,
    )
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update message: ${error?.message}`);
  }

  // Fetch profile for response
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const message = mapMessageResponse(updated, profile);

  return c.json({ message }, 200);
});

// -------------------------------------------------------------------
// DELETE /messages/:messageId - Delete own message
// -------------------------------------------------------------------
const deleteMessageRoute = createRoute({
  method: "delete",
  path: "/messages/{messageId}",
  tags: ["group-messages"],
  summary: "Delete own message",
  description: "Delete a message you posted",
  request: {
    params: MessageIdParamSchema,
  },
  responses: {
    200: {
      description: "Message deleted successfully",
      content: {
        "application/json": {
          schema: DeleteGroupMessageResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    403: {
      description: "Forbidden - Not the message author",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    404: {
      description: "Message not found",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { messageId } = c.req.valid("param");

  // Check message exists and belongs to user
  const { data: existing } = await supabase
    .from("group_messages")
    .select("id, user_id")
    .eq("id", messageId)
    .single();

  if (!existing) {
    throw new NotFoundError("Message not found");
  }

  if (existing.user_id !== user.id) {
    throw new ForbiddenError("You can only delete your own messages");
  }

  const { error } = await supabase
    .from("group_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }

  return c.json({ success: true }, 200);
});

export default app;
