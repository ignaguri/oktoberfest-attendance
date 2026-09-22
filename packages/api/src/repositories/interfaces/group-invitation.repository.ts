import type { GroupInvitation, InvitableUser, SentGroupInvitation } from "@prostcounter/shared";

/** Shape every group-invitation SQL function returns, camelCased */
export type InvitationRpcResult = {
  success: boolean;
  errorCode?: string;
  invitationId?: string;
  groupId?: string;
  inviterId?: string;
  inviteeId?: string;
  festivalId?: string | null;
};

export interface IGroupInvitationRepository {
  /** Invite someone into a group (caller must be the group's creator) */
  invite(groupId: string, inviteeId: string): Promise<InvitationRpcResult>;

  /** Accept an invitation addressed to the authenticated user */
  accept(invitationId: string): Promise<InvitationRpcResult>;

  /** Decline an invitation addressed to the authenticated user */
  decline(invitationId: string): Promise<InvitationRpcResult>;

  /** Withdraw a pending invitation (caller must be the group's creator) */
  cancel(invitationId: string): Promise<InvitationRpcResult>;

  /** Pending invitations addressed to the authenticated user */
  listIncoming(): Promise<GroupInvitation[]>;

  /** Pending invitations the creator sent for one group */
  listSent(groupId: string): Promise<SentGroupInvitation[]>;

  /** Profile search inside one group's invite context, max 20 results */
  listInvitableUsers(
    userId: string,
    groupId: string,
    query: string,
  ): Promise<InvitableUser[]>;
}
