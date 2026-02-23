import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AddPhotoCommentResponseSchema,
  AddPhotoCommentSchema,
  AddPhotoReactionSchema,
  GetPhotoCommentsQuerySchema,
  GetPhotoCommentsResponseSchema,
  GetPhotoReactionsQuerySchema,
  GetPhotoReactionsResponseSchema,
  PhotoSocialSuccessSchema,
  RemovePhotoReactionSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

// Create router
const app = new OpenAPIHono<AuthContext>();

// ===== Error Schemas =====
const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// ===== GET /photos/:photoId/reactions =====
const getReactionsRoute = createRoute({
  method: "get",
  path: "/photos/{photoId}/reactions",
  tags: ["photo-social"],
  summary: "Get reactions for a photo in a group",
  description:
    "Returns aggregated emoji reactions for a photo within a specific group context",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
    }),
    query: GetPhotoReactionsQuerySchema,
  },
  responses: {
    200: {
      description: "Reactions retrieved successfully",
      content: {
        "application/json": {
          schema: GetPhotoReactionsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Forbidden - not a group member",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getReactionsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { groupId } = c.req.valid("query");

  // Verify group membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return c.json(
      { error: "FORBIDDEN", message: "You are not a member of this group" },
      403,
    );
  }

  // Fetch reactions with user profiles
  const { data: reactions, error } = await supabase
    .from("photo_reactions")
    .select(
      `
      emoji,
      user_id,
      profiles!photo_reactions_user_id_profiles_fkey (
        username,
        avatar_url
      )
    `,
    )
    .eq("photo_id", photoId)
    .eq("group_id", groupId);

  if (error) {
    throw new Error(`Failed to fetch reactions: ${error.message}`);
  }

  // Aggregate reactions by emoji
  const emojiMap: Record<
    string,
    {
      count: number;
      users: { userId: string; username: string; avatarUrl: string | null }[];
    }
  > = {};

  const userReactions: string[] = [];

  for (const reaction of reactions || []) {
    const emoji = reaction.emoji;
    if (!emojiMap[emoji]) {
      emojiMap[emoji] = { count: 0, users: [] };
    }
    emojiMap[emoji].count++;

    // Handle profiles - could be array or object depending on Supabase
    const profile = Array.isArray(reaction.profiles)
      ? reaction.profiles[0]
      : reaction.profiles;

    emojiMap[emoji].users.push({
      userId: reaction.user_id,
      username: profile?.username || "Unknown",
      avatarUrl: profile?.avatar_url || null,
    });

    if (reaction.user_id === user.id) {
      userReactions.push(emoji);
    }
  }

  const aggregatedReactions = Object.entries(emojiMap).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    users: data.users,
  }));

  return c.json(
    {
      reactions: aggregatedReactions,
      userReactions,
    },
    200,
  );
});

// ===== POST /photos/:photoId/reactions =====
const addReactionRoute = createRoute({
  method: "post",
  path: "/photos/{photoId}/reactions",
  tags: ["photo-social"],
  summary: "Add a reaction to a photo",
  description: "Adds an emoji reaction to a photo within a group context",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
    }),
    body: {
      content: {
        "application/json": {
          schema: AddPhotoReactionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reaction added successfully",
      content: { "application/json": { schema: PhotoSocialSuccessSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Forbidden - not a group member",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Conflict - reaction already exists",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(addReactionRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { groupId, emoji } = c.req.valid("json");

  // Verify group membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return c.json(
      { error: "FORBIDDEN", message: "You are not a member of this group" },
      403,
    );
  }

  // Insert reaction (unique constraint prevents duplicates)
  const { error } = await supabase.from("photo_reactions").insert({
    photo_id: photoId,
    group_id: groupId,
    user_id: user.id,
    emoji,
  });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      return c.json(
        { error: "CONFLICT", message: "You already reacted with this emoji" },
        409,
      );
    }
    throw new Error(`Failed to add reaction: ${error.message}`);
  }

  return c.json({ success: true }, 200);
});

// ===== DELETE /photos/:photoId/reactions =====
const removeReactionRoute = createRoute({
  method: "delete",
  path: "/photos/{photoId}/reactions",
  tags: ["photo-social"],
  summary: "Remove a reaction from a photo",
  description: "Removes an emoji reaction from a photo within a group context",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
    }),
    body: {
      content: {
        "application/json": {
          schema: RemovePhotoReactionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reaction removed successfully",
      content: { "application/json": { schema: PhotoSocialSuccessSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(removeReactionRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { groupId, emoji } = c.req.valid("json");

  const { error } = await supabase
    .from("photo_reactions")
    .delete()
    .eq("photo_id", photoId)
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("emoji", emoji);

  if (error) {
    throw new Error(`Failed to remove reaction: ${error.message}`);
  }

  return c.json({ success: true }, 200);
});

// ===== GET /photos/:photoId/comments =====
const getCommentsRoute = createRoute({
  method: "get",
  path: "/photos/{photoId}/comments",
  tags: ["photo-social"],
  summary: "Get comments for a photo in a group",
  description:
    "Returns comments for a photo within a specific group context, ordered by creation time",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
    }),
    query: GetPhotoCommentsQuerySchema,
  },
  responses: {
    200: {
      description: "Comments retrieved successfully",
      content: {
        "application/json": {
          schema: GetPhotoCommentsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Forbidden - not a group member",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getCommentsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { groupId } = c.req.valid("query");

  // Verify group membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return c.json(
      { error: "FORBIDDEN", message: "You are not a member of this group" },
      403,
    );
  }

  // Fetch comments with user profiles
  const { data: comments, error } = await supabase
    .from("photo_comments")
    .select(
      `
      id,
      user_id,
      content,
      created_at,
      profiles!photo_comments_user_id_profiles_fkey (
        username,
        avatar_url
      )
    `,
    )
    .eq("photo_id", photoId)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }

  const formattedComments = (comments || []).map((comment) => {
    const profile = Array.isArray(comment.profiles)
      ? comment.profiles[0]
      : comment.profiles;

    return {
      id: comment.id,
      userId: comment.user_id,
      username: profile?.username || "Unknown",
      avatarUrl: profile?.avatar_url || null,
      content: comment.content,
      createdAt: comment.created_at,
    };
  });

  return c.json({ comments: formattedComments }, 200);
});

// ===== POST /photos/:photoId/comments =====
const addCommentRoute = createRoute({
  method: "post",
  path: "/photos/{photoId}/comments",
  tags: ["photo-social"],
  summary: "Add a comment to a photo",
  description: "Adds a text comment to a photo within a group context",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
    }),
    body: {
      content: {
        "application/json": {
          schema: AddPhotoCommentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Comment added successfully",
      content: {
        "application/json": { schema: AddPhotoCommentResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Forbidden - not a group member",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(addCommentRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { groupId, content } = c.req.valid("json");

  // Verify group membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return c.json(
      { error: "FORBIDDEN", message: "You are not a member of this group" },
      403,
    );
  }

  // Insert comment
  const { data: comment, error } = await supabase
    .from("photo_comments")
    .insert({
      photo_id: photoId,
      group_id: groupId,
      user_id: user.id,
      content,
    })
    .select("id, content, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to add comment: ${error.message}`);
  }

  return c.json(
    {
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
      },
    },
    200,
  );
});

// ===== DELETE /photos/:photoId/comments/:commentId =====
const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/photos/{photoId}/comments/{commentId}",
  tags: ["photo-social"],
  summary: "Delete a comment",
  description: "Deletes a user's own comment from a photo",
  request: {
    params: z.object({
      photoId: z.string().uuid("Invalid photo ID"),
      commentId: z.string().uuid("Invalid comment ID"),
    }),
  },
  responses: {
    200: {
      description: "Comment deleted successfully",
      content: { "application/json": { schema: PhotoSocialSuccessSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Comment not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteCommentRoute, async (c) => {
  const { user, supabase } = c.var;
  const { commentId } = c.req.valid("param");

  // RLS ensures user can only delete their own comments
  const { error, count } = await supabase
    .from("photo_comments")
    .delete({ count: "exact" })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }

  if (count === 0) {
    return c.json(
      {
        error: "NOT_FOUND",
        message: "Comment not found or you do not have permission to delete it",
      },
      404,
    );
  }

  return c.json({ success: true }, 200);
});

export default app;
