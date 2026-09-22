import type { GroupInvitation, InvitableUser, SentGroupInvitation } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../middleware/error";
import type { IGroupInvitationRepository, InvitationRpcResult } from "../repositories/interfaces";

/** Turn a failed invitation function result into the matching API error */
function throwForFailure(result: InvitationRpcResult): never {
  switch (result.errorCode) {
    case "UNAUTHORIZED":
      throw new UnauthorizedError(ErrorCodes.UNAUTHORIZED);
    case "NOT_GROUP_CREATOR":
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    case "NOT_INVITATION_RECIPIENT":
      throw new ForbiddenError(ErrorCodes.NOT_INVITATION_RECIPIENT);
    case "CANNOT_INVITE_SELF":
      throw new ForbiddenError(ErrorCodes.CANNOT_INVITE_SELF);
    case "PROFILE_NOT_FOUND":
      throw new NotFoundError(ErrorCodes.PROFILE_NOT_FOUND);
    case "GROUP_INVITATION_NOT_FOUND":
      throw new NotFoundError(ErrorCodes.GROUP_INVITATION_NOT_FOUND);
    case "ALREADY_GROUP_MEMBER":
      throw new ConflictError(ErrorCodes.ALREADY_GROUP_MEMBER);
    case "GROUP_INVITATION_PENDING":
      throw new ConflictError(ErrorCodes.GROUP_INVITATION_PENDING);
    case "JOIN_REQUEST_PENDING":
      throw new ConflictError(ErrorCodes.JOIN_REQUEST_PENDING);
    default:
      throw new ConflictError(ErrorCodes.CONFLICT);
  }
}

/**
 * Invitations into a group, sent by its creator and answered by the invitee
 */
export class GroupInvitationService {
  constructor(private repo: IGroupInvitationRepository) {}

  /** `notifyInvitee` is false when this person was invited and withdrawn in the
   * last 24 hours, so a cancel/re-invite loop cannot push them repeatedly */
  async invite(
    groupId: string,
    inviteeId: string,
  ): Promise<{ invitationId: string; notifyInvitee: boolean }> {
    const result = await this.repo.invite(groupId, inviteeId);
    if (!result.success || !result.invitationId) {
      throwForFailure(result);
    }
    return { invitationId: result.invitationId, notifyInvitee: result.notifyInvitee !== false };
  }

  async accept(invitationId: string): Promise<{
    groupId: string;
    inviterId: string;
    inviteeId: string;
    festivalId: string | null;
  }> {
    const result = await this.repo.accept(invitationId);
    if (!result.success || !result.groupId || !result.inviterId || !result.inviteeId) {
      throwForFailure(result);
    }
    return {
      groupId: result.groupId,
      inviterId: result.inviterId,
      inviteeId: result.inviteeId,
      festivalId: result.festivalId ?? null,
    };
  }

  async decline(invitationId: string): Promise<void> {
    const result = await this.repo.decline(invitationId);
    if (!result.success) {
      throwForFailure(result);
    }
  }

  async cancel(invitationId: string): Promise<void> {
    const result = await this.repo.cancel(invitationId);
    if (!result.success) {
      throwForFailure(result);
    }
  }

  async listIncoming(): Promise<GroupInvitation[]> {
    return await this.repo.listIncoming();
  }

  /** Creator only. A missing group answers the same as a non-creator, so
   * existence cannot be probed. */
  async listSent(groupId: string, userId: string): Promise<SentGroupInvitation[]> {
    await this.assertCreator(groupId, userId);
    return await this.repo.listSent(groupId);
  }

  /** Creator only. A missing group answers the same as a non-creator, so
   * existence cannot be probed. */
  async listInvitableUsers(
    userId: string,
    groupId: string,
    query: string,
  ): Promise<InvitableUser[]> {
    await this.assertCreator(groupId, userId);
    return await this.repo.listInvitableUsers(userId, groupId, query);
  }

  private async assertCreator(groupId: string, userId: string): Promise<void> {
    const isCreator = await this.repo.isGroupCreator(groupId, userId);
    if (!isCreator) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    }
  }
}
