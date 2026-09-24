import { z } from "zod";

export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export const FeedbackKindSchema = z.enum(["day", "bug", "idea"]);

export type FeedbackKind = z.infer<typeof FeedbackKindSchema>;

/** The five faces of the day prompt, worst to best. Also used in the admin email. */
export const FEEDBACK_FACES = [
  { rating: 1, emoji: "😖", labelKey: "feedback.faces.terrible" },
  { rating: 2, emoji: "🙁", labelKey: "feedback.faces.bad" },
  { rating: 3, emoji: "😐", labelKey: "feedback.faces.okay" },
  { rating: 4, emoji: "🙂", labelKey: "feedback.faces.good" },
  { rating: 5, emoji: "🤩", labelKey: "feedback.faces.amazing" },
] as const;

const FeedbackRatingSchema = z.number().int().min(1).max(5);

const RequiredMessageSchema = z.string().trim().min(1).max(FEEDBACK_MESSAGE_MAX_LENGTH);

/**
 * POST /v1/feedback
 */
export const SubmitFeedbackBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("day"),
    rating: FeedbackRatingSchema,
    message: z.string().trim().max(FEEDBACK_MESSAGE_MAX_LENGTH).optional(),
    festivalId: z.string().uuid(),
    day: z.iso.date(),
  }),
  z.object({
    kind: z.literal("bug"),
    message: RequiredMessageSchema,
    festivalId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("idea"),
    message: RequiredMessageSchema,
    festivalId: z.string().uuid().optional(),
  }),
]);

export type SubmitFeedbackBody = z.infer<typeof SubmitFeedbackBodySchema>;

export const SubmitFeedbackResponseSchema = z.object({
  id: z.string().uuid(),
});

export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponseSchema>;

/**
 * GET /v1/feedback/prompt
 */
export const DayFeedbackPromptSchema = z.object({
  festivalId: z.string().uuid(),
  festivalName: z.string(),
  day: z.iso.date(),
});

export type DayFeedbackPrompt = z.infer<typeof DayFeedbackPromptSchema>;

export const GetDayFeedbackPromptResponseSchema = z.object({
  prompt: DayFeedbackPromptSchema.nullable(),
});

export type GetDayFeedbackPromptResponse = z.infer<typeof GetDayFeedbackPromptResponseSchema>;

/**
 * POST /v1/feedback/prompt/dismiss
 */
export const DismissDayFeedbackPromptBodySchema = z.object({
  festivalId: z.string().uuid(),
  day: z.iso.date(),
});

export type DismissDayFeedbackPromptBody = z.infer<typeof DismissDayFeedbackPromptBodySchema>;

export const DismissDayFeedbackPromptResponseSchema = z.object({
  success: z.literal(true),
});

export type DismissDayFeedbackPromptResponse = z.infer<
  typeof DismissDayFeedbackPromptResponseSchema
>;

/**
 * GET /v1/admin/feedback
 */
export const AdminFeedbackItemSchema = z.object({
  id: z.string().uuid(),
  kind: FeedbackKindSchema,
  rating: z.number().int().nullable(),
  message: z.string().nullable(),
  festivalId: z.string().uuid().nullable(),
  festivalName: z.string().nullable(),
  day: z.string().nullable(),
  platform: z.string().nullable(),
  appVersion: z.string().nullable(),
  locale: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    username: z.string().nullable(),
    fullName: z.string().nullable(),
  }),
});

export type AdminFeedbackItem = z.infer<typeof AdminFeedbackItemSchema>;

export const ListAdminFeedbackQuerySchema = z.object({
  kind: FeedbackKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type ListAdminFeedbackQuery = z.infer<typeof ListAdminFeedbackQuerySchema>;

export const ListAdminFeedbackResponseSchema = z.object({
  items: z.array(AdminFeedbackItemSchema),
});

export type ListAdminFeedbackResponse = z.infer<typeof ListAdminFeedbackResponseSchema>;

/**
 * Client form schema. Error messages are i18n keys, rendered with t().
 */
export function createFeedbackFormSchema(kind: FeedbackKind) {
  return z.object({
    rating:
      kind === "day"
        ? z
            .number({ error: "feedback.validation.ratingRequired" })
            .int()
            .min(1, "feedback.validation.ratingRequired")
            .max(5, "feedback.validation.ratingRequired")
        : z.number().int().min(1).max(5).optional(),
    message:
      kind === "day"
        ? z.string().trim().max(FEEDBACK_MESSAGE_MAX_LENGTH, "feedback.validation.tooLong")
        : z
            .string()
            .trim()
            .min(1, "feedback.validation.required")
            .max(FEEDBACK_MESSAGE_MAX_LENGTH, "feedback.validation.tooLong"),
  });
}

export interface FeedbackFormValues {
  rating?: number;
  message: string;
}
