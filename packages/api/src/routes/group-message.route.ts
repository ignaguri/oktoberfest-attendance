import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateGroupMessageResponseSchema,
  CreateGroupMessageSchema,
  DeleteGroupMessageResponseSchema,
  GetGroupMessagesQuerySchema,
  GetGroupMessagesResponseSchema,
  GetMessageFeedQuerySchema,
  GetMessageFeedResponseSchema,
  GroupMessageGroupIdParamSchema,
  GroupMessageParamSchema,
  UpdateGroupMessageResponseSchema,
  UpdateGroupMessageSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { ForbiddenError, NotFoundError } from "../middleware/error";

// Create router
const app = new OpenAPIHono<AuthContext>();

// -------------------------------------------------------------------
// GET /groups/:groupId/messages - List messages for a group
// -------------------------------------------------------------------
const listGroupMessagesRoute = createRoute({
  method: "get",
  path: "/groups/{groupId}/messages",
  tags: ["group-messages"],
  summary: "List messages for a group",
  description:
    "Returns messages for a group with cursor-based pagination. Pinned messages come first.",
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

  // Check membership via RLS - if user is not a member, the query returns empty
  // But we want to explicitly check for a 403
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    throw new ForbiddenError("You are not a member of this group");
  }

  // Fetch pinned messages first (always shown at top)
  const { data: pinnedMessages, error: pinnedError } = await supabase
    .from("group_messages")
    .select(
      `
      id,
      group_id,
      user_id,
      content,
      message_type,
      pinned,
      created_at,
      updated_at
    `,
    )
    .eq("group_id", groupId)
    .eq("pinned", true)
    .order("created_at", { ascending: false });

  if (pinnedError) {
    throw new Error(`Failed to fetch pinned messages: ${pinnedError.message}`);
  }

  // Fetch non-pinned messages with pagination
  let query = supabase
    .from("group_messages")
    .select(
      `
      id,
      group_id,
      user_id,
      content,
      message_type,
      pinned,
      created_at,
      updated_at
    `,
    )
    .eq("group_id", groupId)
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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Map messages with profile info
  const messages = allMessages.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      groupId: m.group_id,
      userId: m.user_id,
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      content: m.content,
      messageType: m.message_type as "message" | "alert",
      pinned: m.pinned,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    };
  });

  return c.json({ messages, nextCursor, hasMore }, 200);
});

// -------------------------------------------------------------------
// GET /messages/feed - Get messages from all user's groups
// -------------------------------------------------------------------
const getMessageFeedRoute = createRoute({
  method: "get",
  path: "/messages/feed",
  tags: ["group-messages"],
  summary: "Get message feed across all groups",
  description:
    "Returns recent messages from all groups the user belongs to, for a given festival",
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
    .select("group_id, groups!inner(id, name, festival_id)")
    .eq("user_id", user.id)
    .eq("groups.festival_id", festivalId);

  if (groupsError) {
    throw new Error(`Failed to fetch user groups: ${groupsError.message}`);
  }

  if (!userGroups || userGroups.length === 0) {
    return c.json({ messages: [], nextCursor: null, hasMore: false }, 200);
  }

  const groupIds = userGroups.map((g) => g.group_id);

  // Build group name map
  const groupNameMap = new Map<string, string>();
  for (const g of userGroups) {
    const groupData = g.groups as unknown as {
      id: string;
      name: string;
      festival_id: string;
    };
    groupNameMap.set(g.group_id, groupData.name);
  }

  // Fetch messages across all groups
  let query = supabase
    .from("group_messages")
    .select(
      `
      id,
      group_id,
      user_id,
      content,
      message_type,
      pinned,
      created_at,
      updated_at
    `,
    )
    .in("group_id", groupIds)
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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Map messages with profile and group info
  const feedMessages = resultMessages.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      groupId: m.group_id,
      userId: m.user_id,
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      content: m.content,
      messageType: m.message_type as "message" | "alert",
      pinned: m.pinned,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      groupName: groupNameMap.get(m.group_id) || "Unknown Group",
    };
  });

  return c.json({ messages: feedMessages, nextCursor, hasMore }, 200);
});

// -------------------------------------------------------------------
// POST /groups/:groupId/messages - Post a new message
// -------------------------------------------------------------------
const createGroupMessageRoute = createRoute({
  method: "post",
  path: "/groups/{groupId}/messages",
  tags: ["group-messages"],
  summary: "Post a new message to a group",
  description: "Create a new message or alert in a group",
  request: {
    params: GroupMessageGroupIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateGroupMessageSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Message created successfully",
      content: {
        "application/json": {
          schema: CreateGroupMessageResponseSchema,
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

app.openapi(createGroupMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { groupId } = c.req.valid("param");
  const { content, messageType } = c.req.valid("json");

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

  // Insert message
  const { data: newMessage, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      user_id: user.id,
      content,
      message_type: messageType,
    })
    .select(
      `
      id,
      group_id,
      user_id,
      content,
      message_type,
      pinned,
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

  const message = {
    id: newMessage.id,
    groupId: newMessage.group_id,
    userId: newMessage.user_id,
    username: profile?.username ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    content: newMessage.content,
    messageType: newMessage.message_type as "message" | "alert",
    pinned: newMessage.pinned,
    createdAt: newMessage.created_at,
    updatedAt: newMessage.updated_at,
  };

  return c.json({ message }, 201);
});

// -------------------------------------------------------------------
// PUT /groups/:groupId/messages/:messageId - Update own message
// -------------------------------------------------------------------
const updateGroupMessageRoute = createRoute({
  method: "put",
  path: "/groups/{groupId}/messages/{messageId}",
  tags: ["group-messages"],
  summary: "Update own message",
  description:
    "Update the content, type, or pinned state of a message you posted",
  request: {
    params: GroupMessageParamSchema,
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

app.openapi(updateGroupMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { groupId, messageId } = c.req.valid("param");
  const updates = c.req.valid("json");

  // Check message exists and belongs to user
  const { data: existing } = await supabase
    .from("group_messages")
    .select("id, user_id, group_id")
    .eq("id", messageId)
    .eq("group_id", groupId)
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
      group_id,
      user_id,
      content,
      message_type,
      pinned,
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

  const message = {
    id: updated.id,
    groupId: updated.group_id,
    userId: updated.user_id,
    username: profile?.username ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    content: updated.content,
    messageType: updated.message_type as "message" | "alert",
    pinned: updated.pinned,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };

  return c.json({ message }, 200);
});

// -------------------------------------------------------------------
// DELETE /groups/:groupId/messages/:messageId - Delete own message
// -------------------------------------------------------------------
const deleteGroupMessageRoute = createRoute({
  method: "delete",
  path: "/groups/{groupId}/messages/{messageId}",
  tags: ["group-messages"],
  summary: "Delete own message",
  description: "Delete a message you posted",
  request: {
    params: GroupMessageParamSchema,
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

app.openapi(deleteGroupMessageRoute, async (c) => {
  const { supabase, user } = c.var;
  const { groupId, messageId } = c.req.valid("param");

  // Check message exists and belongs to user
  const { data: existing } = await supabase
    .from("group_messages")
    .select("id, user_id, group_id")
    .eq("id", messageId)
    .eq("group_id", groupId)
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
