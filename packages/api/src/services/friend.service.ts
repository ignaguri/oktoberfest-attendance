import type {
  Friend,
  FriendRequest,
  FriendshipStatusCheck,
  FriendSuggestion,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../middleware/error";
import type { IFriendRepository } from "../repositories/interfaces";

export class FriendService {
  constructor(private friendRepo: IFriendRepository) {}

  async listFriends(userId: string): Promise<Friend[]> {
    return await this.friendRepo.listFriends(userId);
  }

  async getIncomingRequests(userId: string): Promise<FriendRequest[]> {
    return await this.friendRepo.getIncomingRequests(userId);
  }

  async getOutgoingRequests(userId: string): Promise<FriendRequest[]> {
    return await this.friendRepo.getOutgoingRequests(userId);
  }

  async getIncomingRequestCount(userId: string): Promise<number> {
    return await this.friendRepo.getIncomingRequestCount(userId);
  }

  async sendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<{
    success: boolean;
    friendshipId?: string;
    status?: string;
    message?: string;
  }> {
    if (requesterId === addresseeId) {
      throw new ForbiddenError(ErrorCodes.SELF_FRIEND_REQUEST);
    }

    const result = await this.friendRepo.sendRequest(requesterId, addresseeId);

    if (!result.success) {
      switch (result.errorCode) {
        case "ALREADY_FRIENDS":
          throw new ConflictError(ErrorCodes.ALREADY_FRIENDS);
        case "ALREADY_PENDING":
          throw new ConflictError(ErrorCodes.ALREADY_PENDING);
        case "SELF_REQUEST":
          throw new ForbiddenError(ErrorCodes.SELF_FRIEND_REQUEST);
        default:
          throw new ConflictError(
            result.message || "Failed to send friend request",
          );
      }
    }

    return {
      success: true,
      friendshipId: result.friendshipId,
      status: result.status,
      message: result.message,
    };
  }

  async acceptRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const result = await this.friendRepo.acceptRequest(friendshipId, userId);

    if (!result.success) {
      switch (result.errorCode) {
        case "NOT_FOUND":
          throw new NotFoundError(ErrorCodes.FRIENDSHIP_NOT_FOUND);
        case "FORBIDDEN":
          throw new ForbiddenError(ErrorCodes.FORBIDDEN);
        case "INVALID_STATUS":
          throw new ConflictError(ErrorCodes.INVALID_FRIEND_REQUEST);
        default:
          throw new ConflictError(
            result.message || "Failed to accept friend request",
          );
      }
    }

    return { success: true, message: result.message };
  }

  async declineRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const result = await this.friendRepo.declineRequest(friendshipId, userId);

    if (!result.success) {
      switch (result.errorCode) {
        case "NOT_FOUND":
          throw new NotFoundError(ErrorCodes.FRIENDSHIP_NOT_FOUND);
        case "FORBIDDEN":
          throw new ForbiddenError(ErrorCodes.FORBIDDEN);
        case "INVALID_STATUS":
          throw new ConflictError(ErrorCodes.INVALID_FRIEND_REQUEST);
        default:
          throw new ConflictError(
            result.message || "Failed to decline friend request",
          );
      }
    }

    return { success: true, message: result.message };
  }

  async cancelRequest(friendshipId: string, userId: string): Promise<void> {
    await this.friendRepo.cancelRequest(friendshipId, userId);
  }

  async unfriend(userId: string, friendUserId: string): Promise<void> {
    await this.friendRepo.unfriend(userId, friendUserId);
  }

  async getSuggestions(userId: string): Promise<FriendSuggestion[]> {
    return await this.friendRepo.getSuggestions(userId);
  }

  async searchUsers(
    userId: string,
    query: string,
  ): Promise<
    {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      friendshipStatus:
        | "friends"
        | "pending_sent"
        | "pending_received"
        | "none";
    }[]
  > {
    return await this.friendRepo.searchUsers(userId, query);
  }

  async getFriendshipStatus(
    userId: string,
    otherUserId: string,
  ): Promise<FriendshipStatusCheck> {
    return await this.friendRepo.getFriendshipStatus(userId, otherUserId);
  }
}
