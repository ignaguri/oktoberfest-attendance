import type {
  CarryOverCandidate,
  CreateGroupInput,
  Group,
  GroupGalleryPhoto,
  GroupMember,
  GroupWithMembers,
  ListGroupsQuery,
  SearchGroupResult,
  SearchGroupsQuery,
  UpdateGroupInput,
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

  /**
   * Update group settings
   * @param groupId - Group ID
   * @param data - Update data
   * @returns Updated group
   */
  update(groupId: string, data: UpdateGroupInput): Promise<Group>;

  /**
   * Check if user is the creator of a group
   * @param groupId - Group ID
   * @param userId - User ID
   * @returns True if user is the creator
   */
  isCreator(groupId: string, userId: string): Promise<boolean>;

  /**
   * Search groups by name
   * @param query - Search query parameters
   * @returns Array of matching groups (public info only)
   */
  search(query: SearchGroupsQuery): Promise<SearchGroupResult[]>;

  /**
   * Get all members of a group with profile info
   * @param groupId - Group ID
   * @returns Array of group members
   */
  getMembers(groupId: string): Promise<GroupMember[]>;

  /**
   * Regenerate the invite token for a group
   * @param groupId - Group ID
   * @returns New invite token
   */
  renewInviteToken(groupId: string): Promise<string>;

  /**
   * Get gallery photos from all members in a group
   * @param groupId - Group ID
   * @returns Array of photos with user info
   */
  getGallery(groupId: string): Promise<GroupGalleryPhoto[]>;

  /**
   * List past-festival groups the user created that are not yet carried over
   * into the target festival
   * @param userId - User ID (must be the group creator)
   * @param targetFestivalId - Festival the groups would be carried into
   * @returns Candidates, newest source festival first
   */
  listCarryOverCandidates(userId: string, targetFestivalId: string): Promise<CarryOverCandidate[]>;

  /**
   * Find an existing carry-over of a group into a festival
   * @param sourceGroupId - The original group
   * @param targetFestivalId - Festival to look in
   * @returns The existing clone's group ID, or null if not carried over yet
   */
  findCarryOverTarget(sourceGroupId: string, targetFestivalId: string): Promise<string | null>;

  /**
   * Clone a group into another festival, copying name and winning criteria
   * @param userId - User performing the carry-over (must be the creator)
   * @param sourceGroupId - Group being carried over
   * @param targetFestivalId - Destination festival
   * @returns The newly created group
   */
  carryOver(userId: string, sourceGroupId: string, targetFestivalId: string): Promise<Group>;

  /**
   * Get what is needed to decide whether a festival is over: its end date and
   * the timezone that date is expressed in. Both travel together because
   * comparing the end date against "today" in the wrong zone is off by a day at
   * the boundary.
   * @param festivalId - Festival ID
   * @returns end_date as YYYY-MM-DD plus its timezone, or null if no such festival
   */
  getFestivalSchedule(
    festivalId: string,
  ): Promise<{ endDate: string; timezone: string | null } | null>;
}
