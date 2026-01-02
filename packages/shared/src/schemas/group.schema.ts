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
 * Update group request
 * PUT /api/v1/groups/:id
 */
export const UpdateGroupSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100, "Group name must be 100 characters or less")
    .optional(),
  winningCriteriaId: z.number().int().min(1).max(3).optional(),
  description: z.string().max(500).nullable().optional(),
});

export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

/**
 * List groups query
 * GET /api/v1/groups
 */
export const ListGroupsQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
});

export type ListGroupsQuery = z.infer<typeof ListGroupsQuerySchema>;

/**
 * Search groups query
 * GET /api/v1/groups/search
 */
export const SearchGroupsQuerySchema = z.object({
  name: z.string().min(1, "Search query is required"),
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SearchGroupsQuery = z.infer<typeof SearchGroupsQuerySchema>;

/**
 * Search groups response - public group info (no invite token exposed)
 */
export const SearchGroupResultSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  festivalId: z.uuid(),
  memberCount: z.number().int(),
});

export type SearchGroupResult = z.infer<typeof SearchGroupResultSchema>;

export const SearchGroupsResponseSchema = z.object({
  data: z.array(SearchGroupResultSchema),
});

export type SearchGroupsResponse = z.infer<typeof SearchGroupsResponseSchema>;

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
