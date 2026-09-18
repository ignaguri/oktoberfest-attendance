import type { GroupJoinRequest } from "@prostcounter/shared";

/** Result of the join-request SQL functions, which report failures as an error code */
export interface JoinRequestRpcResult {
  success: boolean;
  errorCode?: string;
  requestId?: string;
  groupId?: string;
  requesterId?: string;
  festivalId?: string | null;
  /** From request_to_join_group: false when the requester recently withdrew a request to this group */
  notifyCreator?: boolean;
}

export interface IGroupJoinRequestRepository {
  /** Ask to join a group as the authenticated user */
  request(groupId: string): Promise<JoinRequestRpcResult>;

  /** Accept a pending request (caller must be the group's creator) */
  accept(requestId: string): Promise<JoinRequestRpcResult>;

  /** Decline a pending request (caller must be the group's creator) */
  decline(requestId: string): Promise<JoinRequestRpcResult>;

  /** Withdraw the authenticated user's pending request for a group */
  cancel(groupId: string): Promise<void>;

  /** Pending requests on groups the user created, minus requesters who are already members */
  listIncoming(creatorId: string): Promise<GroupJoinRequest[]>;

  /** Group ids (of those given) where the user has a pending or recently declined request */
  listBlockingGroupIds(requesterId: string, groupIds: string[]): Promise<string[]>;
}
