import { z } from "zod";

/**
 * Group message type enum
 */
export const GroupMessageTypeSchema = z.enum(["message", "alert"]);

export type GroupMessageType = z.infer<typeof GroupMessageTypeSchema>;

/**
 * Group message item (returned from API)
 */
export const GroupMessageItemSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  content: z.string(),
  messageType: GroupMessageTypeSchema,
  pinned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GroupMessageItem = z.infer<typeof GroupMessageItemSchema>;

/**
 * Group message feed item (includes group info, for cross-group feed)
 */
export const GroupMessageFeedItemSchema = GroupMessageItemSchema.extend({
  groupName: z.string(),
});

export type GroupMessageFeedItem = z.infer<typeof GroupMessageFeedItemSchema>;

/**
 * GET /groups/:groupId/messages query params
 */
export const GetGroupMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

export type GetGroupMessagesQuery = z.infer<typeof GetGroupMessagesQuerySchema>;

/**
 * GET /groups/:groupId/messages response
 */
export const GetGroupMessagesResponseSchema = z.object({
  messages: z.array(GroupMessageItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GetGroupMessagesResponse = z.infer<
  typeof GetGroupMessagesResponseSchema
>;

/**
 * GET /messages/feed query params
 */
export const GetMessageFeedQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

export type GetMessageFeedQuery = z.infer<typeof GetMessageFeedQuerySchema>;

/**
 * GET /messages/feed response
 */
export const GetMessageFeedResponseSchema = z.object({
  messages: z.array(GroupMessageFeedItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GetMessageFeedResponse = z.infer<
  typeof GetMessageFeedResponseSchema
>;

/**
 * POST /groups/:groupId/messages body
 */
export const CreateGroupMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(1000, "Message must be 1000 characters or less"),
  messageType: GroupMessageTypeSchema.default("message"),
});

export type CreateGroupMessageInput = z.infer<
  typeof CreateGroupMessageSchema
>;

/**
 * POST /groups/:groupId/messages response
 */
export const CreateGroupMessageResponseSchema = z.object({
  message: GroupMessageItemSchema,
});

export type CreateGroupMessageResponse = z.infer<
  typeof CreateGroupMessageResponseSchema
>;

/**
 * PUT /groups/:groupId/messages/:messageId body
 */
export const UpdateGroupMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(1000, "Message must be 1000 characters or less")
    .optional(),
  messageType: GroupMessageTypeSchema.optional(),
  pinned: z.boolean().optional(),
});

export type UpdateGroupMessageInput = z.infer<
  typeof UpdateGroupMessageSchema
>;

/**
 * PUT /groups/:groupId/messages/:messageId response
 */
export const UpdateGroupMessageResponseSchema = z.object({
  message: GroupMessageItemSchema,
});

export type UpdateGroupMessageResponse = z.infer<
  typeof UpdateGroupMessageResponseSchema
>;

/**
 * DELETE /groups/:groupId/messages/:messageId response
 */
export const DeleteGroupMessageResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteGroupMessageResponse = z.infer<
  typeof DeleteGroupMessageResponseSchema
>;

/**
 * Message ID + Group ID param schema
 */
export const GroupMessageParamSchema = z.object({
  groupId: z.string().uuid({ message: "Invalid group ID" }),
  messageId: z.string().uuid({ message: "Invalid message ID" }),
});

export type GroupMessageParam = z.infer<typeof GroupMessageParamSchema>;

/**
 * Group ID param for message routes
 */
export const GroupMessageGroupIdParamSchema = z.object({
  groupId: z.string().uuid({ message: "Invalid group ID" }),
});

export type GroupMessageGroupIdParam = z.infer<
  typeof GroupMessageGroupIdParamSchema
>;
