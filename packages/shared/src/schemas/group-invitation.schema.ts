import { z } from "zod";

/**
 * An invitation into a group, as seen by the person invited
 */
export const GroupInvitationSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  groupName: z.string(),
  festivalId: z.uuid(),
  createdAt: z.string(),
  inviter: z.object({
    id: z.uuid(),
    username: z.string().nullable(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});

export type GroupInvitation = z.infer<typeof GroupInvitationSchema>;

/**
 * A pending invitation the creator sent, as seen by the creator
 */
export const SentGroupInvitationSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  createdAt: z.string(),
  invitee: z.object({
    id: z.uuid(),
    username: z.string().nullable(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});

export type SentGroupInvitation = z.infer<typeof SentGroupInvitationSchema>;

/**
 * Where a search result stands with respect to this group.
 *
 * `requested` means they already asked to join, so the creator should answer
 * that request rather than send an invitation the function would refuse.
 */
export const InvitationStatusSchema = z.enum(["none", "invited", "member", "requested"]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const InvitableUserSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  invitationStatus: InvitationStatusSchema,
  /** Set only when invitationStatus is "invited", so the row can offer a cancel */
  invitationId: z.uuid().nullable(),
});

export type InvitableUser = z.infer<typeof InvitableUserSchema>;

export const InviteToGroupSchema = z.object({
  inviteeId: z.uuid({ error: "Invalid user ID" }),
});

export type InviteToGroupInput = z.infer<typeof InviteToGroupSchema>;

export const GroupInvitationIdParamSchema = z.object({
  invitationId: z.uuid({ error: "Invalid invitation ID" }),
});

export type GroupInvitationIdParam = z.infer<typeof GroupInvitationIdParamSchema>;

export const InvitableUsersQuerySchema = z.object({
  q: z.string().optional(),
});

export type InvitableUsersQuery = z.infer<typeof InvitableUsersQuerySchema>;

export const ListGroupInvitationsResponseSchema = z.object({
  data: z.array(GroupInvitationSchema),
});

export type ListGroupInvitationsResponse = z.infer<typeof ListGroupInvitationsResponseSchema>;

export const ListSentGroupInvitationsResponseSchema = z.object({
  data: z.array(SentGroupInvitationSchema),
});

export type ListSentGroupInvitationsResponse = z.infer<
  typeof ListSentGroupInvitationsResponseSchema
>;

export const ListInvitableUsersResponseSchema = z.object({
  data: z.array(InvitableUserSchema),
});

export type ListInvitableUsersResponse = z.infer<typeof ListInvitableUsersResponseSchema>;
