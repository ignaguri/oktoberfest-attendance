import { z } from "zod";

/**
 * Group winning criteria enum
 */
export const WinningCriteriaSchema = z.enum([
  "days_attended",
  "total_beers",
  "avg_beers",
]);

export type WinningCriteria = z.infer<typeof WinningCriteriaSchema>;

/**
 * Group schema
 */
export const GroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  festivalId: z.uuid(),
  winningCriteria: WinningCriteriaSchema,
  inviteToken: z.string(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Group = z.infer<typeof GroupSchema>;

/**
 * Group with member count
 */
export const GroupWithMembersSchema = GroupSchema.extend({
  memberCount: z.number().int(),
});

export type GroupWithMembers = z.infer<typeof GroupWithMembersSchema>;

/**
 * Create group request
 * POST /api/v1/groups
 */
export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100, "Group name must be 100 characters or less"),
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  winningCriteria: WinningCriteriaSchema.default("total_beers"),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

/**
 * List groups query
 * GET /api/v1/groups
 */
export const ListGroupsQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
});

export type ListGroupsQuery = z.infer<typeof ListGroupsQuerySchema>;

/**
 * List groups response
 */
export const ListGroupsResponseSchema = z.object({
  data: z.array(GroupWithMembersSchema),
});

export type ListGroupsResponse = z.infer<typeof ListGroupsResponseSchema>;

/**
 * Join group request
 * POST /api/v1/groups/:id/join
 */
export const JoinGroupSchema = z.object({
  inviteToken: z.string().optional(),
});

export type JoinGroupInput = z.infer<typeof JoinGroupSchema>;

/**
 * Group ID parameter
 */
export const GroupIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid group ID" }),
});

export type GroupIdParam = z.infer<typeof GroupIdParamSchema>;

/**
 * Generic success response
 */
export const GroupActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type GroupActionResponse = z.infer<typeof GroupActionResponseSchema>;
