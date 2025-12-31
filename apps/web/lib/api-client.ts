import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import type {
  FestivalTent,
  ListAttendancesResponse,
  DeleteAttendanceResponse,
  ListGroupsResponse,
  Group,
  GroupActionResponse,
  LeaderboardResponse,
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
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3008/api";

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
     * Get group details
     */
    async get(groupId: string): Promise<ApiResponse<Group>> {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups/${groupId}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch group: ${response.statusText}`);
      }
      return parseJsonResponse<ApiResponse<Group>>(response);
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
      custom_beer_cost?: number | null;
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
  },
};
