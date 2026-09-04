import type {
  CarryOverCandidate,
  CreateGroupInput,
  Group,
  GroupGalleryPhoto,
  GroupMember,
  GroupWithMembers,
  ListGroupsQuery,
  UpdateGroupInput,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";

import { ConflictError, ForbiddenError, NotFoundError } from "../middleware/error";
import type { IGroupRepository } from "../repositories/interfaces";

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
  async listUserGroups(userId: string, query?: ListGroupsQuery): Promise<GroupWithMembers[]> {
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
  async joinGroup(groupId: string, userId: string, inviteToken?: string): Promise<void> {
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
  async updateGroup(groupId: string, userId: string, data: UpdateGroupInput): Promise<Group> {
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
  async removeMember(groupId: string, requesterId: string, targetUserId: string): Promise<void> {
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
  async getGallery(groupId: string, userId: string): Promise<GroupGalleryPhoto[]> {
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

  /**
   * List past-festival groups the caller created that could be carried over
   * into the target festival
   */
  async listCarryOverCandidates(
    userId: string,
    targetFestivalId: string,
  ): Promise<CarryOverCandidate[]> {
    return await this.groupRepo.listCarryOverCandidates(userId, targetFestivalId);
  }

  /**
   * Carry a group over into another festival
   * Only the group creator can do this, and only into a festival that has not ended
   */
  async carryOverGroup(
    sourceGroupId: string,
    userId: string,
    targetFestivalId: string,
  ): Promise<Group> {
    const source = await this.groupRepo.findById(sourceGroupId);

    if (!source) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    const isCreator = await this.groupRepo.isCreator(sourceGroupId, userId);
    if (!isCreator) {
      throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
    }

    if (source.festivalId === targetFestivalId) {
      throw new ConflictError(ErrorCodes.GROUP_ALREADY_CARRIED_OVER);
    }

    const schedule = await this.groupRepo.getFestivalSchedule(targetFestivalId);
    if (!schedule) {
      throw new NotFoundError(ErrorCodes.FESTIVAL_NOT_FOUND);
    }

    // festivals.status and is_active are stale in prod, so the guard compares
    // end_date directly. Both are YYYY-MM-DD, so string compare is safe.
    // "Today" is resolved in the festival's own timezone: end_date is a wall-clock
    // date there, so using the app default would end the festival a day early or
    // late for anything outside Europe/Berlin. `?? undefined` falls back to that
    // default, since festivals.timezone is nullable.
    const today = formatDateForDatabase(new Date(), schedule.timezone ?? undefined);
    if (schedule.endDate < today) {
      throw new ConflictError(ErrorCodes.FESTIVAL_ENDED);
    }

    const existingCarryOver = await this.groupRepo.findCarryOverTarget(
      sourceGroupId,
      targetFestivalId,
    );
    if (existingCarryOver) {
      throw new ConflictError(ErrorCodes.GROUP_ALREADY_CARRIED_OVER);
    }

    return await this.groupRepo.carryOver(userId, sourceGroupId, targetFestivalId);
  }
}
