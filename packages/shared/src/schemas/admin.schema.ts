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
    username: z.string(),
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
