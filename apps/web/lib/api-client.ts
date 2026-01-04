import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import type {
  FestivalTent,
  ListAttendancesResponse,
  DeleteAttendanceResponse,
  ListGroupsResponse,
  Group,
  GroupWithMembers,
  GroupActionResponse,
  LeaderboardResponse,
  WinningCriteriaListResponse,
  ListAchievementsResponse,
  EvaluateAchievementsResponse,
  ListFestivalsResponse,
  GetFestivalResponse,
  GetCalendarEventsResponse,
  ProfileShort,
  Profile,
  TutorialStatus,
  MissingProfileFields,
  Highlights,
} from "@prostcounter/shared/schemas";

/**
 * API response wrapper type
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

/**
 * Get auth headers for API requests
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
  };
}

/**
 * Parse JSON response with error handling and type safety
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Base URL for API requests
 * Uses relative URL by default, which works for any deployment (local, preview, production)
 * Set NEXT_PUBLIC_API_URL for explicit override (e.g., external API server)
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Type-safe API client
 * Simple wrapper around fetch with authentication
 */
export const apiClient = {
  /**
   * Attendance API
   */
  attendance: {
    /**
     * List user's attendances
     */
    async list(query?: {
      festivalId?: string;
      limit?: number;
      offset?: number;
    }): Promise<ListAttendancesResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.festivalId) params.set("festivalId", query.festivalId);
      if (query?.limit) params.set("limit", query.limit.toString());
      if (query?.offset) params.set("offset", query.offset.toString());

      const url = `${API_BASE_URL}/v1/attendance?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch attendances: ${response.statusText}`);
      }
      return parseJsonResponse<ListAttendancesResponse>(response);
    },

    /**
     * Delete an attendance record
     */
    async delete(attendanceId: string): Promise<DeleteAttendanceResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/attendance/${attendanceId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to delete attendance");
      }
      return parseJsonResponse<DeleteAttendanceResponse>(response);
    },

    /**
     * Create or update attendance with tents
     */
    async create(data: {
      festivalId: string;
      date: string;
      tents?: string[];
      amount?: number;
    }): Promise<{ attendanceId: string; tentsChanged: boolean }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/attendance`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to create attendance");
      }
      return parseJsonResponse<{ attendanceId: string; tentsChanged: boolean }>(
        response,
      );
    },

    /**
     * Update personal attendance without triggering notifications
     */
    async updatePersonal(data: {
      festivalId: string;
      date: string;
      tents?: string[];
      amount?: number;
    }): Promise<{
      attendanceId: string;
      tentsAdded: string[];
      tentsRemoved: string[];
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/attendance/personal`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to update attendance");
      }
      return parseJsonResponse<{
        attendanceId: string;
        tentsAdded: string[];
        tentsRemoved: string[];
      }>(response);
    },

    /**
     * Check in from a reservation
     */
    async checkInFromReservation(
      reservationId: string,
    ): Promise<{ success: boolean; message: string; attendanceId?: string }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/attendance/check-in/${reservationId}`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to check in");
      }
      return parseJsonResponse<{
        success: boolean;
        message: string;
        attendanceId?: string;
      }>(response);
    },
  },

  /**
   * Groups API
   */
  groups: {
    /**
     * List user's groups
     */
    async list(query?: { festivalId?: string }): Promise<ListGroupsResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams(
        query?.festivalId ? { festivalId: query.festivalId } : {},
      );
      const url = `${API_BASE_URL}/v1/groups?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
      }
      return parseJsonResponse<ListGroupsResponse>(response);
    },

    /**
     * Search groups by name
     */
    async search(query: {
      name: string;
      festivalId?: string;
      limit?: number;
    }): Promise<{
      data: Array<{
        id: string;
        name: string;
        festivalId: string;
        memberCount: number;
      }>;
    }> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ name: query.name });
      if (query.festivalId) params.set("festivalId", query.festivalId);
      if (query.limit) params.set("limit", query.limit.toString());
      const url = `${API_BASE_URL}/v1/groups/search?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to search groups: ${response.statusText}`);
      }
      return parseJsonResponse<{
        data: Array<{
          id: string;
          name: string;
          festivalId: string;
          memberCount: number;
        }>;
      }>(response);
    },

    /**
     * Get group details
     */
    async get(groupId: string): Promise<ApiResponse<GroupWithMembers>> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups/${groupId}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch group: ${response.statusText}`);
      }
      // API returns GroupWithMembers directly, wrap it for consistency
      const group = await parseJsonResponse<GroupWithMembers>(response);
      return { data: group };
    },

    /**
     * Create a new group
     */
    async create(data: {
      name: string;
      festivalId: string;
      winningCriteria?: string;
    }): Promise<ApiResponse<Group>> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to create group");
      }
      // API returns Group directly, wrap it in ApiResponse format for consistency
      const group = await parseJsonResponse<Group>(response);
      return { data: group };
    },

    /**
     * Join a group
     */
    async join(
      groupId: string,
      inviteToken?: string,
    ): Promise<GroupActionResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/join`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ inviteToken }),
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to join group");
      }
      return parseJsonResponse<GroupActionResponse>(response);
    },

    /**
     * Leave a group
     */
    async leave(groupId: string): Promise<GroupActionResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/leave`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to leave group");
      }
      return parseJsonResponse<GroupActionResponse>(response);
    },

    /**
     * Get group leaderboard
     */
    async leaderboard(groupId: string): Promise<LeaderboardResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/leaderboard`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch group leaderboard: ${response.statusText}`,
        );
      }
      return parseJsonResponse<LeaderboardResponse>(response);
    },

    /**
     * Update group settings
     */
    async update(
      groupId: string,
      data: {
        name?: string;
        winningCriteriaId?: number;
        description?: string | null;
      },
    ): Promise<Group> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups/${groupId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to update group");
      }
      return parseJsonResponse<Group>(response);
    },

    /**
     * Get group members
     */
    async getMembers(groupId: string): Promise<{
      data: Array<{
        userId: string;
        username: string;
        fullName: string | null;
        avatarUrl: string | null;
        joinedAt: string;
      }>;
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/members`,
        { headers },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to fetch group members");
      }
      return parseJsonResponse<{
        data: Array<{
          userId: string;
          username: string;
          fullName: string | null;
          avatarUrl: string | null;
          joinedAt: string;
        }>;
      }>(response);
    },

    /**
     * Remove a member from group
     */
    async removeMember(
      groupId: string,
      userId: string,
    ): Promise<{ success: boolean; message: string }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/members/${userId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to remove member");
      }
      return parseJsonResponse<{ success: boolean; message: string }>(response);
    },

    /**
     * Regenerate group invite token
     */
    async renewToken(groupId: string): Promise<{ inviteToken: string }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/token/renew`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to regenerate invite token");
      }
      return parseJsonResponse<{ inviteToken: string }>(response);
    },

    /**
     * Get group photo gallery
     */
    async getGallery(groupId: string): Promise<{
      data: Array<{
        id: string;
        userId: string;
        username: string;
        fullName: string | null;
        avatarUrl: string | null;
        pictureUrl: string;
        date: string;
        createdAt: string;
      }>;
      total: number;
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/gallery`,
        { headers },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to fetch group gallery");
      }
      return parseJsonResponse<{
        data: Array<{
          id: string;
          userId: string;
          username: string;
          fullName: string | null;
          avatarUrl: string | null;
          pictureUrl: string;
          date: string;
          createdAt: string;
        }>;
        total: number;
      }>(response);
    },

    /**
     * Join a group by invite token only
     */
    async joinByToken(inviteToken: string): Promise<{
      success: boolean;
      message: string;
      group: Group;
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups/join-by-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ inviteToken }),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to join group");
      }
      return parseJsonResponse<{
        success: boolean;
        message: string;
        group: Group;
      }>(response);
    },
  },

  /**
   * Leaderboard API
   */
  leaderboard: {
    /**
     * Get global leaderboard
     */
    async global(query?: {
      festivalId?: string;
      sortBy?: string;
      limit?: number;
      offset?: number;
    }): Promise<LeaderboardResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.festivalId) params.set("festivalId", query.festivalId);
      if (query?.sortBy) params.set("sortBy", query.sortBy);
      if (query?.limit) params.set("limit", query.limit.toString());
      if (query?.offset) params.set("offset", query.offset.toString());
      const url = `${API_BASE_URL}/v1/leaderboard?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch global leaderboard: ${response.statusText}`,
        );
      }
      return parseJsonResponse<LeaderboardResponse>(response);
    },

    /**
     * Get winning criteria options
     */
    async winningCriteria(): Promise<WinningCriteriaListResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/leaderboard/winning-criteria`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch winning criteria: ${response.statusText}`,
        );
      }
      return parseJsonResponse<WinningCriteriaListResponse>(response);
    },
  },

  /**
   * Achievements API
   */
  achievements: {
    /**
     * Get user's achievements
     */
    async list(query?: {
      festivalId?: string;
      category?: string;
    }): Promise<ListAchievementsResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.festivalId) params.set("festivalId", query.festivalId);
      if (query?.category) params.set("category", query.category);
      const url = `${API_BASE_URL}/v1/achievements?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch achievements: ${response.statusText}`);
      }
      return parseJsonResponse<ListAchievementsResponse>(response);
    },

    /**
     * Trigger achievement evaluation
     */
    async evaluate(festivalId?: string): Promise<EvaluateAchievementsResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/achievements/evaluate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ festivalId }),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to evaluate achievements");
      }
      return parseJsonResponse<EvaluateAchievementsResponse>(response);
    },
  },

  /**
   * Tents API
   */
  tents: {
    /**
     * List tents
     */
    async list(query?: {
      festivalId?: string;
    }): Promise<ApiResponse<FestivalTent[]>> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.festivalId) params.set("festivalId", query.festivalId);
      const url = `${API_BASE_URL}/v1/tents?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch tents: ${response.statusText}`);
      }
      return parseJsonResponse<ApiResponse<FestivalTent[]>>(response);
    },
  },

  /**
   * Festivals API
   */
  festivals: {
    /**
     * List festivals
     */
    async list(query?: {
      status?: string;
      isActive?: boolean;
    }): Promise<ListFestivalsResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.status) params.set("status", query.status);
      if (query?.isActive !== undefined)
        params.set("isActive", query.isActive.toString());
      const url = `${API_BASE_URL}/v1/festivals?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch festivals: ${response.statusText}`);
      }
      return parseJsonResponse<ListFestivalsResponse>(response);
    },

    /**
     * Get festival by ID
     */
    async get(festivalId: string): Promise<GetFestivalResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/festivals/${festivalId}`,
        {
          headers,
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch festival: ${response.statusText}`);
      }
      return parseJsonResponse<GetFestivalResponse>(response);
    },
  },

  /**
   * Calendar API
   */
  calendar: {
    /**
     * Get personal calendar events
     */
    async personal(festivalId: string): Promise<GetCalendarEventsResponse> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ festivalId });
      const url = `${API_BASE_URL}/v1/calendar/personal?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch personal calendar: ${response.statusText}`,
        );
      }
      return parseJsonResponse<GetCalendarEventsResponse>(response);
    },

    /**
     * Get group calendar events
     */
    async group(groupId: string): Promise<GetCalendarEventsResponse> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/calendar/group/${groupId}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch group calendar: ${response.statusText}`,
        );
      }
      return parseJsonResponse<GetCalendarEventsResponse>(response);
    },
  },

  /**
   * Profile API
   */
  profile: {
    /**
     * Get current user's profile
     */
    async get(): Promise<{ profile: ProfileShort }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/profile`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }
      return parseJsonResponse<{ profile: ProfileShort }>(response);
    },

    /**
     * Update current user's profile
     */
    async update(data: {
      username?: string;
      full_name?: string;
    }): Promise<{ profile: Profile }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to update profile");
      }
      return parseJsonResponse<{ profile: Profile }>(response);
    },

    /**
     * Delete current user's account
     */
    async delete(): Promise<{ success: boolean; message: string }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/profile`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to delete account");
      }
      return parseJsonResponse<{ success: boolean; message: string }>(response);
    },

    /**
     * Get tutorial status
     */
    async getTutorialStatus(): Promise<{ status: TutorialStatus }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/profile/tutorial`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch tutorial status: ${response.statusText}`,
        );
      }
      return parseJsonResponse<{ status: TutorialStatus }>(response);
    },

    /**
     * Complete tutorial
     */
    async completeTutorial(): Promise<{ success: boolean }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/tutorial/complete`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to complete tutorial: ${response.statusText}`);
      }
      return parseJsonResponse<{ success: boolean }>(response);
    },

    /**
     * Reset tutorial
     */
    async resetTutorial(): Promise<{ success: boolean }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/tutorial/reset`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to reset tutorial: ${response.statusText}`);
      }
      return parseJsonResponse<{ success: boolean }>(response);
    },

    /**
     * Get missing profile fields
     */
    async getMissingFields(): Promise<{
      missingFields: MissingProfileFields;
      hasMissingFields: boolean;
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/missing-fields`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch missing fields: ${response.statusText}`,
        );
      }
      return parseJsonResponse<{
        missingFields: MissingProfileFields;
        hasMissingFields: boolean;
      }>(response);
    },

    /**
     * Get user highlights
     */
    async getHighlights(
      festivalId: string,
    ): Promise<{ highlights: Highlights }> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ festivalId });
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/highlights?${params}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch highlights: ${response.statusText}`);
      }
      return parseJsonResponse<{ highlights: Highlights }>(response);
    },

    /**
     * Get signed URL for avatar upload
     */
    async getAvatarUploadUrl(query: {
      fileName: string;
      fileType: string;
      fileSize: number;
    }): Promise<{
      uploadUrl: string;
      publicUrl: string;
      expiresIn: number;
    }> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        fileName: query.fileName,
        fileType: query.fileType,
        fileSize: query.fileSize.toString(),
      });
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/avatar/upload-url?${params}`,
        { headers },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to get avatar upload URL");
      }
      return parseJsonResponse<{
        uploadUrl: string;
        publicUrl: string;
        expiresIn: number;
      }>(response);
    },

    /**
     * Confirm avatar upload
     */
    async confirmAvatarUpload(avatarUrl: string): Promise<{
      success: boolean;
      avatarUrl: string;
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/profile/avatar/confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ avatarUrl }),
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to confirm avatar upload");
      }
      return parseJsonResponse<{
        success: boolean;
        avatarUrl: string;
      }>(response);
    },
  },

  /**
   * Reservations API
   */
  reservations: {
    /**
     * List user reservations
     */
    async list(query?: {
      festivalId?: string;
      status?: "pending" | "confirmed" | "checked_in" | "cancelled" | "expired";
      upcoming?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<{
      reservations: Array<{
        id: string;
        userId: string;
        festivalId: string;
        tentId: string;
        tentName?: string;
        startAt: string;
        endAt: string | null;
        status:
          | "pending"
          | "confirmed"
          | "checked_in"
          | "cancelled"
          | "expired";
        note: string | null;
        visibleToGroups: boolean;
        autoCheckin: boolean;
        reminderOffsetMinutes: number;
        reminderSentAt: string | null;
        promptSentAt: string | null;
        processedAt: string | null;
        createdAt: string;
        updatedAt: string | null;
      }>;
      total: number;
      limit: number;
      offset: number;
    }> {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (query?.festivalId) params.set("festivalId", query.festivalId);
      if (query?.status) params.set("status", query.status);
      if (query?.upcoming !== undefined)
        params.set("upcoming", query.upcoming.toString());
      if (query?.limit) params.set("limit", query.limit.toString());
      if (query?.offset) params.set("offset", query.offset.toString());

      const response = await fetch(
        `${API_BASE_URL}/v1/reservations?${params}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch reservations: ${response.statusText}`);
      }
      return parseJsonResponse(response);
    },

    /**
     * Get a single reservation
     */
    async get(reservationId: string): Promise<{
      reservation: {
        id: string;
        userId: string;
        festivalId: string;
        tentId: string;
        tentName?: string;
        startAt: string;
        endAt: string | null;
        status:
          | "pending"
          | "confirmed"
          | "checked_in"
          | "cancelled"
          | "expired";
        note: string | null;
        visibleToGroups: boolean;
        autoCheckin: boolean;
        reminderOffsetMinutes: number;
        reminderSentAt: string | null;
        promptSentAt: string | null;
        processedAt: string | null;
        createdAt: string;
        updatedAt: string | null;
      };
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/reservations/${reservationId}`,
        { headers },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to fetch reservation");
      }
      return parseJsonResponse(response);
    },

    /**
     * Create a new reservation
     */
    async create(data: {
      festivalId: string;
      tentId: string;
      startAt: string;
      endAt?: string;
      note?: string;
      visibleToGroups?: boolean;
      autoCheckin?: boolean;
      reminderOffsetMinutes?: number;
    }): Promise<{
      reservation: {
        id: string;
        userId: string;
        festivalId: string;
        tentId: string;
        tentName?: string;
        startAt: string;
        endAt: string | null;
        status:
          | "pending"
          | "confirmed"
          | "checked_in"
          | "cancelled"
          | "expired";
        note: string | null;
        visibleToGroups: boolean;
        autoCheckin: boolean;
        reminderOffsetMinutes: number;
        reminderSentAt: string | null;
        promptSentAt: string | null;
        processedAt: string | null;
        createdAt: string;
        updatedAt: string | null;
      };
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/reservations`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to create reservation");
      }
      return parseJsonResponse(response);
    },

    /**
     * Update a reservation
     */
    async update(
      reservationId: string,
      data: {
        startAt?: string;
        endAt?: string | null;
        note?: string | null;
        visibleToGroups?: boolean;
        autoCheckin?: boolean;
        reminderOffsetMinutes?: number;
      },
    ): Promise<{
      reservation: {
        id: string;
        userId: string;
        festivalId: string;
        tentId: string;
        tentName?: string;
        startAt: string;
        endAt: string | null;
        status:
          | "pending"
          | "confirmed"
          | "checked_in"
          | "cancelled"
          | "expired";
        note: string | null;
        visibleToGroups: boolean;
        autoCheckin: boolean;
        reminderOffsetMinutes: number;
        reminderSentAt: string | null;
        promptSentAt: string | null;
        processedAt: string | null;
        createdAt: string;
        updatedAt: string | null;
      };
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/reservations/${reservationId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to update reservation");
      }
      return parseJsonResponse(response);
    },

    /**
     * Cancel a reservation
     */
    async cancel(reservationId: string): Promise<{
      reservation: {
        id: string;
        status: "cancelled";
      };
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/reservations/${reservationId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to cancel reservation");
      }
      return parseJsonResponse(response);
    },

    /**
     * Check in to a reservation
     */
    async checkIn(reservationId: string): Promise<{
      reservation: {
        id: string;
        status: "checked_in";
      };
      attendance?: {
        id: string;
        date: string;
      };
    }> {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/reservations/${reservationId}/checkin`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        const error = await parseJsonResponse<{ message?: string }>(
          response,
        ).catch(() => ({ message: undefined }));
        throw new Error(error.message || "Failed to check in");
      }
      return parseJsonResponse(response);
    },
  },
};
