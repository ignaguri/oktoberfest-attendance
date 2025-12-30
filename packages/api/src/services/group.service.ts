import type { IGroupRepository } from "../repositories/interfaces";
import type {
  Group,
  GroupWithMembers,
  CreateGroupInput,
  ListGroupsQuery,
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
      throw new NotFoundError("Group not found");
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError("You are not a member of this group");
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
      throw new NotFoundError("Group not found");
    }

    // If invite token provided, verify it matches
    if (inviteToken && group.inviteToken !== inviteToken) {
      throw new ForbiddenError("Invalid invite token");
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
      throw new NotFoundError("Group not found");
    }

    // Verify user is a member
    const isMember = await this.groupRepo.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError("You are not a member of this group");
    }

    // Remove member
    await this.groupRepo.removeMember(groupId, userId);
  }
}
