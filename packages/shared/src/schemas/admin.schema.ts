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

// =============================================================================
// Festivals
// =============================================================================

export const FestivalTypeSchema = z.enum([
  "oktoberfest",
  "starkbierfest",
  "fruehlingsfest",
  "other",
]);

export type FestivalType = z.infer<typeof FestivalTypeSchema>;

export const AdminFestivalStatusSchema = z.enum(["upcoming", "active", "ended"]);

/**
 * Admin view of a festival, in the database's own snake_case.
 *
 * Distinct from the public `FestivalSchema`, which is camelCase and omits the
 * columns only an admin edits (short_name, festival_type, description).
 */
export const AdminFestivalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  short_name: z.string(),
  festival_type: FestivalTypeSchema,
  location: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  map_url: z.string().nullable(),
  timezone: z.string(),
  is_active: z.boolean(),
  status: AdminFestivalStatusSchema,
  description: z.string().nullable(),
  beer_cost: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AdminFestival = z.infer<typeof AdminFestivalSchema>;

/**
 * A real calendar day, not just YYYY-MM-DD shaped.
 *
 * The regex alone lets 2026-13-45 through, and it also passes the string
 * comparison the range refinements use, so it reaches Postgres and comes back
 * as a 500. Same reasoning as the positive() guard on beer_cost: mirror what
 * the column will accept rather than letting the database do the rejecting.
 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Expected YYYY-MM-DD" })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { error: "Not a real calendar date" },
  );

const festivalDateRange = {
  start_date: calendarDate,
  end_date: calendarDate,
};

export const CreateAdminFestivalSchema = z
  .object({
    name: z.string().min(1).max(255),
    short_name: z.string().min(1).max(100),
    festival_type: FestivalTypeSchema,
    location: z.string().min(1).max(255),
    ...festivalDateRange,
    map_url: z.string().url().nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
    is_active: z.boolean().optional(),
    status: AdminFestivalStatusSchema,
    description: z.string().nullable().optional(),
    // The database enforces beer_cost > 0 via a CHECK constraint; mirror it here
    // so a bad value fails validation instead of surfacing as a 500.
    beer_cost: z.number().positive().nullable().optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    error: "end_date must not be before start_date",
    path: ["end_date"],
  });

export type CreateAdminFestivalInput = z.infer<typeof CreateAdminFestivalSchema>;

export const UpdateAdminFestivalSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    short_name: z.string().min(1).max(100).optional(),
    festival_type: FestivalTypeSchema.optional(),
    location: z.string().min(1).max(255).optional(),
    start_date: festivalDateRange.start_date.optional(),
    end_date: festivalDateRange.end_date.optional(),
    map_url: z.string().url().nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
    is_active: z.boolean().optional(),
    status: AdminFestivalStatusSchema.optional(),
    description: z.string().nullable().optional(),
    beer_cost: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) =>
      data.start_date === undefined ||
      data.end_date === undefined ||
      data.end_date >= data.start_date,
    { error: "end_date must not be before start_date", path: ["end_date"] },
  );

export type UpdateAdminFestivalInput = z.infer<typeof UpdateAdminFestivalSchema>;

// =============================================================================
// Tents
// =============================================================================

/**
 * The only categories a tent can have.
 *
 * `tents_category_check` allows exactly these three, so free text is not a
 * looser validation, it is a 500 waiting for the first admin who types
 * "Festzelt". Mirror the constraint here and the request fails as a 400 with
 * a usable message instead. (The web panel offers a six-item dropdown of which
 * none pass the check, so there is no working precedent to port.)
 */
export const TENT_CATEGORIES = ["large", "small", "old"] as const;

const tentCategory = z.enum(TENT_CATEGORIES);

export type TentCategory = (typeof TENT_CATEGORIES)[number];

/**
 * A tent in the global `tents` catalogue, independent of any festival.
 *
 * Assignment and pricing live in `festival_tents`, so editing a tent here
 * changes it for every festival that uses it.
 */
export const AdminTentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: tentCategory.nullable(),
});

export type AdminTent = z.infer<typeof AdminTentSchema>;

export const CreateAdminTentSchema = z.object({
  name: z.string().min(1).max(255),
  category: tentCategory.nullable().optional(),
});

export type CreateAdminTentInput = z.infer<typeof CreateAdminTentSchema>;

export const UpdateAdminTentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: tentCategory.nullable().optional(),
});

export type UpdateAdminTentInput = z.infer<typeof UpdateAdminTentSchema>;

/**
 * A beer price in euros, or null to clear it.
 *
 * Positive rather than non-negative because `drink_type_prices_positive_price`
 * rejects anything <= 0. "No price" is therefore null, which deletes the
 * canonical row rather than storing a zero that would read as free beer.
 *
 * Capped at what `festival_tents.beer_price` can hold: the column is
 * numeric(5,2), so a typo'd 1000 would come back as `numeric field overflow`
 * and a 500 rather than a rejected request.
 */
const beerPriceEuros = z.number().positive().max(999.99).nullable();

/** A tent as assigned to one festival, carrying that festival's price for it. */
export const AdminFestivalTentSchema = z.object({
  festival_tent_id: z.string().uuid(),
  tent_id: z.string().uuid(),
  name: z.string(),
  category: tentCategory.nullable(),
  beer_price: z.number().nullable(),
});

export type AdminFestivalTent = z.infer<typeof AdminFestivalTentSchema>;

export const AddAdminFestivalTentSchema = z.object({
  tent_id: z.string().uuid(),
  beer_price: beerPriceEuros.optional(),
});

export type AddAdminFestivalTentInput = z.infer<typeof AddAdminFestivalTentSchema>;

export const AddAllAdminFestivalTentsSchema = z.object({
  beer_price: beerPriceEuros.optional(),
});

export type AddAllAdminFestivalTentsInput = z.infer<typeof AddAllAdminFestivalTentsSchema>;

export const UpdateAdminFestivalTentPriceSchema = z.object({
  beer_price: beerPriceEuros,
});

export type UpdateAdminFestivalTentPriceInput = z.infer<typeof UpdateAdminFestivalTentPriceSchema>;

export const CopyAdminFestivalTentsSchema = z.object({
  source_festival_id: z.string().uuid(),
  tent_ids: z.array(z.string().uuid()).min(1),
  copy_prices: z.boolean().optional(),
  override_price: beerPriceEuros.optional(),
});

export type CopyAdminFestivalTentsInput = z.infer<typeof CopyAdminFestivalTentsSchema>;

/**
 * Per-festival tent counts.
 *
 * `avg_price` is null when no tent has a price, rather than the web panel's 0 —
 * an average of nothing is not free beer.
 */
export const AdminFestivalTentStatsSchema = z.object({
  total_tents: z.number(),
  categories: z.record(z.string(), z.number()),
  with_custom_pricing: z.number(),
  avg_price: z.number().nullable(),
});

export type AdminFestivalTentStats = z.infer<typeof AdminFestivalTentStatsSchema>;
