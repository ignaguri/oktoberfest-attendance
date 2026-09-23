import type { GroupJoinRequest } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../middleware/error";
import type { IGroupJoinRequestRepository, JoinRequestRpcResult } from "../repositories/interfaces";

/** Turn a failed join-request function result into the matching API error */
function throwForFailure(result: JoinRequestRpcResult): never {
  switch (result.errorCode) {
    case "UNAUTHORIZED":
      throw new UnauthorizedError(ErrorCodes.UNAUTHORIZED);
    case "GROUP_NOT_FOUND":
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    case "ALREADY_GROUP_MEMBER":
      throw new ConflictError(ErrorCodes.ALREADY_GROUP_MEMBER);
    case "JOIN_REQUEST_PENDING":
      throw new ConflictError(ErrorCodes.JOIN_REQUEST_PENDING);
    case "GROUP_INVITATION_RECEIVED":
      throw new ConflictError(ErrorCodes.GROUP_INVITATION_RECEIVED);
    case "JOIN_REQUEST_NOT_FOUND":
      throw new NotFoundError(ErrorCodes.JOIN_REQUEST_NOT_FOUND);
    case "NOT_GROUP_CREATOR":
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    default:
      throw new ConflictError(ErrorCodes.CONFLICT);
  }
}

/**
 * Requests to join a group, answered by the group's creator
 */
export class GroupJoinRequestService {
  constructor(private repo: IGroupJoinRequestRepository) {}

  /** `notifyCreator` is false when the requester recently withdrew a request to this group */
  async request(groupId: string): Promise<{ notifyCreator: boolean }> {
    const result = await this.repo.request(groupId);
    if (!result.success) {
      throwForFailure(result);
    }
    return { notifyCreator: result.notifyCreator !== false };
  }

  async accept(
    requestId: string,
  ): Promise<{ groupId: string; requesterId: string; festivalId: string | null }> {
    const result = await this.repo.accept(requestId);
    if (!result.success || !result.groupId || !result.requesterId) {
      throwForFailure(result);
    }
    return {
      groupId: result.groupId,
      requesterId: result.requesterId,
      festivalId: result.festivalId ?? null,
    };
  }

  async decline(requestId: string): Promise<void> {
    const result = await this.repo.decline(requestId);
    if (!result.success) {
      throwForFailure(result);
    }
  }

  async cancel(groupId: string): Promise<void> {
    await this.repo.cancel(groupId);
  }

  async listIncoming(creatorId: string): Promise<GroupJoinRequest[]> {
    return await this.repo.listIncoming(creatorId);
  }
}
