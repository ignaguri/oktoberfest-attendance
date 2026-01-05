import { ErrorCodes } from "@prostcounter/shared/errors";

import type { IGroupRepository } from "../repositories/interfaces";
import type {
  Group,
  GroupWithMembers,
  CreateGroupInput,
  UpdateGroupInput,
  ListGroupsQuery,
  GroupMember,
  GroupGalleryPhoto,
} from "@prostcounter/shared";

import { NotFoundError, ForbiddenError } from "../middleware/error";

/**
 * Group Service
 * Handles business logic for group management
 */
export class GroupService {
  constructor(private groupRepo: IGroupRepository) {}

  /**
   * Create a new group
   * Automatically adds creator as first member
   */
  async createGroup(userId: string, data: CreateGroupInput): Promise<Group> {
    const group = await this.groupRepo.create(userId, data);
    return group;
  }

  /**
   * List groups for a user
   */
  async listUserGroups(
    userId: string,
    query?: ListGroupsQuery,
  ): Promise<GroupWithMembers[]> {
    return await this.groupRepo.listUserGroups(userId, query);
  }

  /**
   * Get group details
   * Verifies user has access to the group
   */
  async getGroup(groupId: string, userId: string): Promise<GroupWithMembers> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_MEMBER);
    }

    return group;
  }

  /**
   * Join a group
   * Can join by group ID (if already member) or by invite token
   */
  async joinGroup(
    groupId: string,
    userId: string,
    inviteToken?: string,
  ): Promise<void> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // If invite token provided, verify it matches
    if (inviteToken && group.inviteToken !== inviteToken) {
      throw new ForbiddenError(ErrorCodes.INVALID_INVITE_TOKEN);
    }

    // Add member (will throw if already a member)
    await this.groupRepo.addMember(groupId, userId);
  }

  /**
   * Leave a group
   * Users can only leave groups they're in
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_MEMBER);
    }

    // Remove member
    await this.groupRepo.removeMember(groupId, userId);
  }

  /**
   * Update group settings
   * Only the group creator can update
   */
  async updateGroup(
    groupId: string,
    userId: string,
    data: UpdateGroupInput,
  ): Promise<Group> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is the creator
    const isCreator = await this.groupRepo.isCreator(groupId, userId);
    if (!isCreator) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    }

    return await this.groupRepo.update(groupId, data);
  }

  /**
   * Get group members
   * Only group members can view the member list
   */
  async getMembers(groupId: string, userId: string): Promise<GroupMember[]> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_MEMBER);
    }

    return await this.groupRepo.getMembers(groupId);
  }

  /**
   * Remove a member from a group
   * Only the group creator can remove members (except themselves)
   */
  async removeMember(
    groupId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify requester is the creator
    const isCreator = await this.groupRepo.isCreator(groupId, requesterId);
    if (!isCreator) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    }

    // Cannot remove the creator
    if (targetUserId === requesterId) {
      throw new ForbiddenError(ErrorCodes.CANNOT_REMOVE_SELF);
    }

    // Verify target is a member
    const isMember = await this.groupRepo.isMember(groupId, targetUserId);
    if (!isMember) {
      throw new NotFoundError(ErrorCodes.USER_NOT_GROUP_MEMBER);
    }

    await this.groupRepo.removeMember(groupId, targetUserId);
  }

  /**
   * Renew group invite token
   * Only the group creator can renew the token
   */
  async renewInviteToken(groupId: string, userId: string): Promise<string> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is the creator
    const isCreator = await this.groupRepo.isCreator(groupId, userId);
    if (!isCreator) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    }

    return await this.groupRepo.renewInviteToken(groupId);
  }

  /**
   * Get group gallery
   * Only group members can view the gallery
   */
  async getGallery(
    groupId: string,
    userId: string,
  ): Promise<GroupGalleryPhoto[]> {
    const group = await this.groupRepo.findById(groupId);

    if (!group) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_MEMBER);
    }

    return await this.groupRepo.getGallery(groupId);
  }

  /**
   * Join group by invite token
   * Finds group by token and adds user as member
   */
  async joinByToken(inviteToken: string, userId: string): Promise<Group> {
    const group = await this.groupRepo.findByInviteToken(inviteToken);

    if (!group) {
      throw new NotFoundError(ErrorCodes.INVALID_INVITE_TOKEN);
    }

    // Add member (will throw if already a member)
    await this.groupRepo.addMember(group.id, userId);

    return group;
  }
}
