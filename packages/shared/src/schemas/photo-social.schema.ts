import { z } from "zod";

// ===== Allowed Emojis =====

export const ALLOWED_EMOJIS = [
  "\u{1F37A}", // beer mug
  "\u2764\uFE0F", // red heart
  "\u{1F602}", // face with tears of joy
  "\u{1F525}", // fire
  "\u{1F44F}", // clapping hands
  "\u{1F92E}", // face vomiting
] as const;

export const EmojiSchema = z.string().refine(
  (val) => (ALLOWED_EMOJIS as readonly string[]).includes(val),
  { message: "Invalid emoji. Must be one of the allowed reactions." },
);

// ===== Reaction Schemas =====

/**
 * Query params for GET /photos/:photoId/reactions
 */
export const GetPhotoReactionsQuerySchema = z.object({
  groupId: z.string().uuid("Invalid group ID"),
});

export type GetPhotoReactionsQuery = z.infer<
  typeof GetPhotoReactionsQuerySchema
>;

/**
 * A user who reacted with a specific emoji
 */
export const ReactionUserSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
});

export type ReactionUser = z.infer<typeof ReactionUserSchema>;

/**
 * Aggregated reaction for a single emoji
 */
export const AggregatedReactionSchema = z.object({
  emoji: z.string(),
  count: z.number().int(),
  users: z.array(ReactionUserSchema),
});

export type AggregatedReaction = z.infer<typeof AggregatedReactionSchema>;

/**
 * Response for GET /photos/:photoId/reactions
 */
export const GetPhotoReactionsResponseSchema = z.object({
  reactions: z.array(AggregatedReactionSchema),
  userReactions: z.array(z.string()),
});

export type GetPhotoReactionsResponse = z.infer<
  typeof GetPhotoReactionsResponseSchema
>;

/**
 * Body for POST /photos/:photoId/reactions
 */
export const AddPhotoReactionSchema = z.object({
  groupId: z.string().uuid("Invalid group ID"),
  emoji: EmojiSchema,
});

export type AddPhotoReactionInput = z.infer<typeof AddPhotoReactionSchema>;

/**
 * Body for DELETE /photos/:photoId/reactions
 */
export const RemovePhotoReactionSchema = z.object({
  groupId: z.string().uuid("Invalid group ID"),
  emoji: EmojiSchema,
});

export type RemovePhotoReactionInput = z.infer<
  typeof RemovePhotoReactionSchema
>;

// ===== Comment Schemas =====

/**
 * Query params for GET /photos/:photoId/comments
 */
export const GetPhotoCommentsQuerySchema = z.object({
  groupId: z.string().uuid("Invalid group ID"),
});

export type GetPhotoCommentsQuery = z.infer<typeof GetPhotoCommentsQuerySchema>;

/**
 * A single comment
 */
export const PhotoCommentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
});

export type PhotoComment = z.infer<typeof PhotoCommentSchema>;

/**
 * Response for GET /photos/:photoId/comments
 */
export const GetPhotoCommentsResponseSchema = z.object({
  comments: z.array(PhotoCommentSchema),
});

export type GetPhotoCommentsResponse = z.infer<
  typeof GetPhotoCommentsResponseSchema
>;

/**
 * Body for POST /photos/:photoId/comments
 */
export const AddPhotoCommentSchema = z.object({
  groupId: z.string().uuid("Invalid group ID"),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment must be 500 characters or less"),
});

export type AddPhotoCommentInput = z.infer<typeof AddPhotoCommentSchema>;

/**
 * Response for POST /photos/:photoId/comments
 */
export const AddPhotoCommentResponseSchema = z.object({
  comment: z.object({
    id: z.string(),
    content: z.string(),
    createdAt: z.string(),
  }),
});

export type AddPhotoCommentResponse = z.infer<
  typeof AddPhotoCommentResponseSchema
>;

/**
 * Success response for mutations
 */
export const PhotoSocialSuccessSchema = z.object({
  success: z.boolean(),
});

export type PhotoSocialSuccess = z.infer<typeof PhotoSocialSuccessSchema>;
