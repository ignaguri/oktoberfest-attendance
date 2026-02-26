import { z } from "zod";

/**
 * Group message type enum
 */
export const GroupMessageTypeSchema = z.enum(["message", "alert"]);

export type GroupMessageType = z.infer<typeof GroupMessageTypeSchema>;

/**
 * Message visibility enum
 */
export const MessageVisibilitySchema = z.enum(["groups", "public"]);

export type MessageVisibility = z.infer<typeof MessageVisibilitySchema>;

/**
 * Message item (returned from API)
 *
 * Messages are no longer scoped to a single group. They belong to a user + festival
 * and are visible to all groups the user is a member of.
 */
export const GroupMessageItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  content: z.string(),
  messageType: GroupMessageTypeSchema,
  pinned: z.boolean(),
  visibility: MessageVisibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GroupMessageItem = z.infer<typeof GroupMessageItemSchema>;

/**
 * Message feed item — same as GroupMessageItem (kept as alias for existing imports)
 */
export const GroupMessageFeedItemSchema = GroupMessageItemSchema;

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
 * POST /messages body
 */
export const CreateMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(1000, "Message must be 1000 characters or less"),
  messageType: GroupMessageTypeSchema.default("message"),
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
});

export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;

/**
 * POST /messages response
 */
export const CreateMessageResponseSchema = z.object({
  message: GroupMessageItemSchema,
});

export type CreateMessageResponse = z.infer<typeof CreateMessageResponseSchema>;

/**
 * @deprecated Use CreateMessageSchema instead
 */
export const CreateGroupMessageSchema = CreateMessageSchema;
export type CreateGroupMessageInput = CreateMessageInput;
export const CreateGroupMessageResponseSchema = CreateMessageResponseSchema;
export type CreateGroupMessageResponse = CreateMessageResponse;

/**
 * PUT /messages/:messageId body
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
 * PUT /messages/:messageId response
 */
export const UpdateGroupMessageResponseSchema = z.object({
  message: GroupMessageItemSchema,
});

export type UpdateGroupMessageResponse = z.infer<
  typeof UpdateGroupMessageResponseSchema
>;

/**
 * DELETE /messages/:messageId response
 */
export const DeleteGroupMessageResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteGroupMessageResponse = z.infer<
  typeof DeleteGroupMessageResponseSchema
>;

/**
 * Message ID param schema (for PUT/DELETE without groupId)
 */
export const MessageIdParamSchema = z.object({
  messageId: z.string().uuid({ message: "Invalid message ID" }),
});

export type MessageIdParam = z.infer<typeof MessageIdParamSchema>;

/**
 * Group ID param for group message board route
 */
export const GroupMessageGroupIdParamSchema = z.object({
  groupId: z.string().uuid({ message: "Invalid group ID" }),
});

export type GroupMessageGroupIdParam = z.infer<
  typeof GroupMessageGroupIdParamSchema
>;

/**
 * @deprecated Use MessageIdParamSchema instead
 */
export const GroupMessageParamSchema = z.object({
  groupId: z.string().uuid({ message: "Invalid group ID" }),
  messageId: z.string().uuid({ message: "Invalid message ID" }),
});

export type GroupMessageParam = z.infer<typeof GroupMessageParamSchema>;
