import type {
  Group,
  GroupWithMembers,
  CreateGroupInput,
  ListGroupsQuery,
} from "@prostcounter/shared";

/**
 * Group repository interface
 * Provides data access for group records
 */
export interface IGroupRepository {
  /**
   * Create a new group
   * @param userId - User ID creating the group
   * @param data - Group creation data
   * @returns Created group
   */
  create(userId: string, data: CreateGroupInput): Promise<Group>;

  /**
   * List groups for a user
   * @param userId - User ID
   * @param query - Query parameters (festivalId filter)
   * @returns Array of groups with member counts
   */
  listUserGroups(userId: string, query?: ListGroupsQuery): Promise<GroupWithMembers[]>;

  /**
   * Get a group by ID
   * @param id - Group ID
   * @returns Group with member count, or null if not found
   */
  findById(id: string): Promise<GroupWithMembers | null>;

  /**
   * Get a group by invite token
   * @param inviteToken - Invite token
   * @returns Group, or null if not found
   */
  findByInviteToken(inviteToken: string): Promise<Group | null>;

  /**
   * Add a user to a group
   * @param groupId - Group ID
   * @param userId - User ID to add
   */
  addMember(groupId: string, userId: string): Promise<void>;

  /**
   * Remove a user from a group
   * @param groupId - Group ID
   * @param userId - User ID to remove
   */
  removeMember(groupId: string, userId: string): Promise<void>;

  /**
   * Check if user is member of a group
   * @param groupId - Group ID
   * @param userId - User ID
   * @returns True if user is a member
   */
  isMember(groupId: string, userId: string): Promise<boolean>;
}
