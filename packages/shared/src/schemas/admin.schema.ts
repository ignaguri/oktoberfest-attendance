import { z } from "zod";

/**
 * Admin API schemas
 *
 * Request/response shapes for the `/v1/admin/*` endpoints, which sit behind the
 * requireAdmin middleware. Distinct from `admin-forms.schema.ts`, which holds
 * the client-side form validation used by the admin UIs.
 */

// =============================================================================
// Location sessions
// =============================================================================

export const AdminLocationSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  isActive: z.boolean(),
  startedAt: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    // profiles.username is nullable and the admin query returns it unchanged,
    // so a half-finished profile surfaces here as null.
    username: z.string().nullable(),
    fullName: z.string().nullable(),
  }),
  festival: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

export type AdminLocationSession = z.infer<typeof AdminLocationSessionSchema>;

export const ListAdminLocationSessionsQuerySchema = z.object({
  festivalId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  includeExpired: z.boolean().optional(),
});

export type ListAdminLocationSessionsQuery = z.infer<typeof ListAdminLocationSessionsQuerySchema>;

// =============================================================================
// Users
// =============================================================================

export const AdminUserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_super_admin: z.boolean().nullable(),
});

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  created_at: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  profile: AdminUserProfileSchema.nullable(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

export const ListAdminUsersResponseSchema = z.object({
  users: z.array(AdminUserSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  /**
   * True when the auth directory was larger than the scan ceiling, so the
   * result may be incomplete. Surfaced rather than hidden -- silently
   * truncating an admin search is worse than saying so.
   */
  truncated: z.boolean(),
});

export type ListAdminUsersResponse = z.infer<typeof ListAdminUsersResponseSchema>;

/** Profile fields an admin may change on another user. */
export const UpdateAdminUserProfileSchema = z.object({
  username: z.string().min(3).max(30).nullable().optional(),
  full_name: z.string().min(1).max(100).nullable().optional(),
  is_super_admin: z.boolean().optional(),
});

export type UpdateAdminUserProfileInput = z.infer<typeof UpdateAdminUserProfileSchema>;

/** Auth fields an admin may change. Requires the service role. */
export const UpdateAdminUserAuthSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((data) => data.email !== undefined || data.password !== undefined, {
    error: "Provide an email or a password to change",
  });

export type UpdateAdminUserAuthInput = z.infer<typeof UpdateAdminUserAuthSchema>;

// =============================================================================
// Attendances
// =============================================================================

export const AdminAttendanceSchema = z.object({
  id: z.string().uuid(),
  // Nullable in the database: attendances.user_id carries no NOT NULL
  // constraint, so an orphaned row is representable even if RLS makes one
  // unlikely in practice.
  user_id: z.string().uuid().nullable(),
  festival_id: z.string().uuid(),
  date: z.string(),
  beer_count: z.number(),
  tent_ids: z.array(z.string().uuid()),
});

export type AdminAttendance = z.infer<typeof AdminAttendanceSchema>;

export const UpdateAdminAttendanceSchema = z.object({
  date: z.string().optional(),
  beer_count: z.number().int().min(0).optional(),
  tent_ids: z.array(z.string().uuid()).optional(),
});

export type UpdateAdminAttendanceInput = z.infer<typeof UpdateAdminAttendanceSchema>;

// =============================================================================
// Groups
// =============================================================================

/**
 * Admin view of a group.
 *
 * Deliberately omits `password` and `invite_token`. The web panel selects "*",
 * which ships both to the browser; neither is needed to administer a group, and
 * a group password has no business leaving the server.
 */
export const AdminGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  winning_criteria_id: z.number(),
  festival_id: z.string().uuid(),
  created_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  member_count: z.number(),
});

export type AdminGroup = z.infer<typeof AdminGroupSchema>;

export const UpdateAdminGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  winning_criteria_id: z.number().int().positive().optional(),
});

export type UpdateAdminGroupInput = z.infer<typeof UpdateAdminGroupSchema>;

export const AdminGroupMemberSchema = z.object({
  id: z.string().uuid(),
  // Nullable in the database, like attendances.user_id: group_members.user_id
  // carries no NOT NULL constraint.
  user_id: z.string().uuid().nullable(),
  joined_at: z.string().nullable(),
  username: z.string().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export type AdminGroupMember = z.infer<typeof AdminGroupMemberSchema>;

export const WinningCriterionSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export type WinningCriterion = z.infer<typeof WinningCriterionSchema>;
