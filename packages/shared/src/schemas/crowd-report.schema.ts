import { z } from "zod";

/**
 * Crowd level enum matching the database enum
 */
export const CrowdLevelSchema = z.enum([
  "empty",
  "moderate",
  "crowded",
  "full",
]);

export type CrowdLevel = z.infer<typeof CrowdLevelSchema>;

/**
 * Single crowd report
 */
export const CrowdReportSchema = z.object({
  id: z.string().uuid(),
  tentId: z.string().uuid(),
  festivalId: z.string().uuid(),
  userId: z.string().uuid(),
  crowdLevel: CrowdLevelSchema,
  waitTimeMinutes: z.number().int().min(0).max(180).nullable(),
  createdAt: z.string(),
});

export type CrowdReport = z.infer<typeof CrowdReportSchema>;

/**
 * Crowd report with user info (for listing reports)
 */
export const CrowdReportWithUserSchema = CrowdReportSchema.extend({
  username: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type CrowdReportWithUser = z.infer<typeof CrowdReportWithUserSchema>;

/**
 * Aggregated crowd status for a tent
 */
export const TentCrowdStatusSchema = z.object({
  tentId: z.string().uuid(),
  tentName: z.string(),
  festivalId: z.string().uuid().nullable(),
  reportCount: z.number().int(),
  crowdLevel: CrowdLevelSchema.nullable(),
  avgWaitMinutes: z.number().nullable(),
  lastReportedAt: z.string().nullable(),
});

export type TentCrowdStatus = z.infer<typeof TentCrowdStatusSchema>;

/**
 * Query parameters for crowd status
 * GET /api/v1/tents/crowd-status
 */
export const GetCrowdStatusQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
});

export type GetCrowdStatusQuery = z.infer<typeof GetCrowdStatusQuerySchema>;

/**
 * Response for crowd status
 */
export const GetCrowdStatusResponseSchema = z.object({
  data: z.array(TentCrowdStatusSchema),
});

export type GetCrowdStatusResponse = z.infer<
  typeof GetCrowdStatusResponseSchema
>;

/**
 * Query parameters for tent crowd reports
 * GET /api/v1/tents/:tentId/crowd-reports
 */
export const GetTentCrowdReportsQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
});

export type GetTentCrowdReportsQuery = z.infer<
  typeof GetTentCrowdReportsQuerySchema
>;

/**
 * Response for tent crowd reports
 */
export const GetTentCrowdReportsResponseSchema = z.object({
  data: z.array(CrowdReportWithUserSchema),
});

export type GetTentCrowdReportsResponse = z.infer<
  typeof GetTentCrowdReportsResponseSchema
>;

/**
 * Request body for submitting a crowd report
 * POST /api/v1/tents/:tentId/crowd-report
 */
export const SubmitCrowdReportBodySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
  crowdLevel: CrowdLevelSchema,
  waitTimeMinutes: z.number().int().min(0).max(180).optional(),
});

export type SubmitCrowdReportBody = z.infer<typeof SubmitCrowdReportBodySchema>;

/**
 * Response for submitting a crowd report
 */
export const SubmitCrowdReportResponseSchema = z.object({
  report: z.object({
    id: z.string().uuid(),
    crowdLevel: CrowdLevelSchema,
    waitTimeMinutes: z.number().int().nullable(),
    createdAt: z.string(),
  }),
});

export type SubmitCrowdReportResponse = z.infer<
  typeof SubmitCrowdReportResponseSchema
>;
