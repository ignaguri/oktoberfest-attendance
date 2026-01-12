/**
 * High-level typed API client factory
 *
 * Creates a typed API client with convenience methods for all endpoints.
 * Used by both web (Next.js) and mobile (Expo) apps.
 */

// Import shared schema types
import type {
  FestivalTent,
  ListAttendancesResponse,
  DeleteAttendanceResponse,
  AttendanceByDate,
  ListGroupsResponse,
  Group,
  GroupWithMembers,
  GroupActionResponse,
  LeaderboardResponse,
  WinningCriteriaListResponse,
  ListAchievementsResponse,
  EvaluateAchievementsResponse,
  GetAchievementsWithProgressResponse,
  GetAchievementLeaderboardResponse,
  ListAvailableAchievementsResponse,
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
 * Headers type compatible with both browser and Node.js environments
 */
export type ApiHeaders = Record<string, string>;

/**
 * Configuration for creating the API client
 */
export interface ApiClientConfig {
  /** Base URL for API requests (e.g., "/api" or "https://api.example.com") */
  baseUrl: string;
  /** Function to get auth headers for requests */
  getAuthHeaders: () => Promise<ApiHeaders>;
}

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
 * API Error with error code for i18n translation
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parse JSON response with error handling and type safety
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Create a typed API client with all endpoint methods
 */
export function createTypedApiClient(config: ApiClientConfig) {
  const { baseUrl, getAuthHeaders } = config;

  return {
    /**
     * Attendance API
     */
    attendance: {
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

        const url = `${baseUrl}/v1/attendance?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch attendances: ${response.statusText}`);
        }
        return parseJsonResponse<ListAttendancesResponse>(response);
      },

      async delete(attendanceId: string): Promise<DeleteAttendanceResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/attendance/${attendanceId}`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to delete attendance");
        }
        return parseJsonResponse<DeleteAttendanceResponse>(response);
      },

      async create(data: {
        festivalId: string;
        date: string;
        tents?: string[];
        amount?: number;
      }): Promise<{ attendanceId: string; tentsChanged: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/attendance`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to create attendance");
        }
        return parseJsonResponse<{ attendanceId: string; tentsChanged: boolean }>(response);
      },

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
        const response = await fetch(`${baseUrl}/v1/attendance/personal`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update attendance");
        }
        return parseJsonResponse<{
          attendanceId: string;
          tentsAdded: string[];
          tentsRemoved: string[];
        }>(response);
      },

      async checkInFromReservation(
        reservationId: string
      ): Promise<{ success: boolean; message: string; attendanceId?: string }> {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${baseUrl}/v1/attendance/check-in/${reservationId}`,
          {
            method: "POST",
            headers,
          }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to check in");
        }
        return parseJsonResponse<{
          success: boolean;
          message: string;
          attendanceId?: string;
        }>(response);
      },

      async getByDate(query: {
        festivalId: string;
        date: string;
      }): Promise<{ attendance: AttendanceByDate | null }> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({
          festivalId: query.festivalId,
          date: query.date,
        });
        const response = await fetch(`${baseUrl}/v1/attendance/by-date?${params}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch attendance: ${response.statusText}`);
        }
        return parseJsonResponse<{ attendance: AttendanceByDate | null }>(response);
      },
    },

    /**
     * Groups API
     */
    groups: {
      async list(query?: { festivalId?: string }): Promise<ListGroupsResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams(
          query?.festivalId ? { festivalId: query.festivalId } : {}
        );
        const url = `${baseUrl}/v1/groups?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch groups: ${response.statusText}`);
        }
        return parseJsonResponse<ListGroupsResponse>(response);
      },

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
        const url = `${baseUrl}/v1/groups/search?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to search groups: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },

      async get(groupId: string): Promise<ApiResponse<GroupWithMembers>> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch group: ${response.statusText}`);
        }
        const group = await parseJsonResponse<GroupWithMembers>(response);
        return { data: group };
      },

      async create(data: {
        name: string;
        festivalId: string;
        winningCriteria?: string;
      }): Promise<ApiResponse<Group>> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to create group");
        }
        const group = await parseJsonResponse<Group>(response);
        return { data: group };
      },

      async join(groupId: string, inviteToken?: string): Promise<GroupActionResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/join`, {
          method: "POST",
          headers,
          body: JSON.stringify({ inviteToken }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to join group");
        }
        return parseJsonResponse<GroupActionResponse>(response);
      },

      async leave(groupId: string): Promise<GroupActionResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/leave`, {
          method: "POST",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to leave group");
        }
        return parseJsonResponse<GroupActionResponse>(response);
      },

      async leaderboard(groupId: string): Promise<LeaderboardResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/leaderboard`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch group leaderboard: ${response.statusText}`);
        }
        return parseJsonResponse<LeaderboardResponse>(response);
      },

      async update(
        groupId: string,
        data: {
          name?: string;
          winningCriteriaId?: number;
          description?: string | null;
        }
      ): Promise<Group> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update group");
        }
        return parseJsonResponse<Group>(response);
      },

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
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/members`, {
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to fetch group members");
        }
        return parseJsonResponse(response);
      },

      async removeMember(
        groupId: string,
        userId: string
      ): Promise<{ success: boolean; message: string }> {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${baseUrl}/v1/groups/${groupId}/members/${userId}`,
          {
            method: "DELETE",
            headers,
          }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to remove member");
        }
        return parseJsonResponse<{ success: boolean; message: string }>(response);
      },

      async renewToken(groupId: string): Promise<{ inviteToken: string }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/token/renew`, {
          method: "POST",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to regenerate invite token");
        }
        return parseJsonResponse<{ inviteToken: string }>(response);
      },

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
        const response = await fetch(`${baseUrl}/v1/groups/${groupId}/gallery`, {
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to fetch group gallery");
        }
        return parseJsonResponse(response);
      },

      async joinByToken(inviteToken: string): Promise<{
        success: boolean;
        message: string;
        group: Group;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/groups/join-by-token`, {
          method: "POST",
          headers,
          body: JSON.stringify({ inviteToken }),
        });
        if (!response.ok) {
          const errorResponse = await parseJsonResponse<{
            error?: { message?: string; code?: string; statusCode?: number };
          }>(response).catch(() => ({ error: undefined }));
          const message = errorResponse?.error?.message || "Failed to join group";
          const code = errorResponse?.error?.code || "UNKNOWN_ERROR";
          throw new ApiError(code, message, response.status);
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Leaderboard API
     */
    leaderboard: {
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
        const url = `${baseUrl}/v1/leaderboard?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch global leaderboard: ${response.statusText}`);
        }
        return parseJsonResponse<LeaderboardResponse>(response);
      },

      async winningCriteria(): Promise<WinningCriteriaListResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/leaderboard/winning-criteria`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch winning criteria: ${response.statusText}`);
        }
        return parseJsonResponse<WinningCriteriaListResponse>(response);
      },
    },

    /**
     * Achievements API
     */
    achievements: {
      async list(query?: {
        festivalId?: string;
        category?: string;
      }): Promise<ListAchievementsResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        if (query?.festivalId) params.set("festivalId", query.festivalId);
        if (query?.category) params.set("category", query.category);
        const url = `${baseUrl}/v1/achievements?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch achievements: ${response.statusText}`);
        }
        return parseJsonResponse<ListAchievementsResponse>(response);
      },

      async evaluate(festivalId?: string): Promise<EvaluateAchievementsResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/achievements/evaluate`, {
          method: "POST",
          headers,
          body: JSON.stringify({ festivalId }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to evaluate achievements");
        }
        return parseJsonResponse<EvaluateAchievementsResponse>(response);
      },

      async getWithProgress(
        festivalId: string
      ): Promise<GetAchievementsWithProgressResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ festivalId });
        const url = `${baseUrl}/v1/achievements/with-progress?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch achievements with progress: ${response.statusText}`
          );
        }
        return parseJsonResponse<GetAchievementsWithProgressResponse>(response);
      },

      async leaderboard(festivalId: string): Promise<GetAchievementLeaderboardResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ festivalId });
        const url = `${baseUrl}/v1/achievements/leaderboard?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch achievement leaderboard: ${response.statusText}`
          );
        }
        return parseJsonResponse<GetAchievementLeaderboardResponse>(response);
      },

      async available(): Promise<ListAvailableAchievementsResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/achievements/available`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch available achievements: ${response.statusText}`
          );
        }
        return parseJsonResponse<ListAvailableAchievementsResponse>(response);
      },
    },

    /**
     * Tents API
     */
    tents: {
      async list(query?: { festivalId?: string }): Promise<ApiResponse<FestivalTent[]>> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        if (query?.festivalId) params.set("festivalId", query.festivalId);
        const url = `${baseUrl}/v1/tents?${params}`;
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
      async list(query?: {
        status?: string;
        isActive?: boolean;
      }): Promise<ListFestivalsResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        if (query?.status) params.set("status", query.status);
        if (query?.isActive !== undefined)
          params.set("isActive", query.isActive.toString());
        const url = `${baseUrl}/v1/festivals?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch festivals: ${response.statusText}`);
        }
        return parseJsonResponse<ListFestivalsResponse>(response);
      },

      async get(festivalId: string): Promise<GetFestivalResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/festivals/${festivalId}`, {
          headers,
        });
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
      async personal(festivalId: string): Promise<GetCalendarEventsResponse> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ festivalId });
        const url = `${baseUrl}/v1/calendar/personal?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch personal calendar: ${response.statusText}`);
        }
        return parseJsonResponse<GetCalendarEventsResponse>(response);
      },

      async group(groupId: string): Promise<GetCalendarEventsResponse> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/calendar/group/${groupId}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch group calendar: ${response.statusText}`);
        }
        return parseJsonResponse<GetCalendarEventsResponse>(response);
      },
    },

    /**
     * Profile API
     */
    profile: {
      async get(): Promise<{ profile: ProfileShort }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.statusText}`);
        }
        return parseJsonResponse<{ profile: ProfileShort }>(response);
      },

      async update(data: {
        username?: string;
        full_name?: string;
      }): Promise<{ profile: Profile }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update profile");
        }
        return parseJsonResponse<{ profile: Profile }>(response);
      },

      async delete(): Promise<{ success: boolean; message: string }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to delete account");
        }
        return parseJsonResponse<{ success: boolean; message: string }>(response);
      },

      async getTutorialStatus(): Promise<{ status: TutorialStatus }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile/tutorial`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch tutorial status: ${response.statusText}`);
        }
        return parseJsonResponse<{ status: TutorialStatus }>(response);
      },

      async completeTutorial(): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile/tutorial/complete`, {
          method: "POST",
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to complete tutorial: ${response.statusText}`);
        }
        return parseJsonResponse<{ success: boolean }>(response);
      },

      async resetTutorial(): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile/tutorial/reset`, {
          method: "POST",
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to reset tutorial: ${response.statusText}`);
        }
        return parseJsonResponse<{ success: boolean }>(response);
      },

      async getMissingFields(): Promise<{
        missingFields: MissingProfileFields;
        hasMissingFields: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile/missing-fields`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch missing fields: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },

      async getHighlights(festivalId: string): Promise<{ highlights: Highlights }> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ festivalId });
        const response = await fetch(`${baseUrl}/v1/profile/highlights?${params}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch highlights: ${response.statusText}`);
        }
        return parseJsonResponse<{ highlights: Highlights }>(response);
      },

      async getAvatarUploadUrl(query: {
        fileName: string;
        fileType: string;
        fileSize: number;
      }): Promise<{
        uploadUrl: string;
        fileName: string;
        expiresIn: number;
      }> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({
          fileName: query.fileName,
          fileType: query.fileType,
          fileSize: query.fileSize.toString(),
        });
        const response = await fetch(
          `${baseUrl}/v1/profile/avatar/upload-url?${params}`,
          { headers }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to get avatar upload URL");
        }
        return parseJsonResponse(response);
      },

      async confirmAvatarUpload(fileName: string): Promise<{
        success: boolean;
        fileName: string;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/profile/avatar/confirm`, {
          method: "POST",
          headers,
          body: JSON.stringify({ fileName }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to confirm avatar upload");
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Reservations API
     */
    reservations: {
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
          status: "pending" | "confirmed" | "checked_in" | "cancelled" | "expired";
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

        const response = await fetch(`${baseUrl}/v1/reservations?${params}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch reservations: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },

      async get(reservationId: string): Promise<{
        reservation: {
          id: string;
          userId: string;
          festivalId: string;
          tentId: string;
          tentName?: string;
          startAt: string;
          endAt: string | null;
          status: "pending" | "confirmed" | "checked_in" | "cancelled" | "expired";
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
        const response = await fetch(`${baseUrl}/v1/reservations/${reservationId}`, {
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to fetch reservation");
        }
        return parseJsonResponse(response);
      },

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
          status: "pending" | "confirmed" | "checked_in" | "cancelled" | "expired";
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
        const response = await fetch(`${baseUrl}/v1/reservations`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to create reservation");
        }
        return parseJsonResponse(response);
      },

      async update(
        reservationId: string,
        data: {
          startAt?: string;
          endAt?: string | null;
          note?: string | null;
          visibleToGroups?: boolean;
          autoCheckin?: boolean;
          reminderOffsetMinutes?: number;
        }
      ): Promise<{
        reservation: {
          id: string;
          userId: string;
          festivalId: string;
          tentId: string;
          tentName?: string;
          startAt: string;
          endAt: string | null;
          status: "pending" | "confirmed" | "checked_in" | "cancelled" | "expired";
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
        const response = await fetch(`${baseUrl}/v1/reservations/${reservationId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update reservation");
        }
        return parseJsonResponse(response);
      },

      async cancel(reservationId: string): Promise<{
        reservation: { id: string; status: "cancelled" };
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/reservations/${reservationId}`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to cancel reservation");
        }
        return parseJsonResponse(response);
      },

      async checkIn(reservationId: string): Promise<{
        reservation: { id: string; status: "checked_in" };
        attendance?: { id: string; date: string };
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${baseUrl}/v1/reservations/${reservationId}/checkin`,
          {
            method: "POST",
            headers,
          }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to check in");
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Activity Feed API
     */
    activityFeed: {
      async get(query: {
        festivalId: string;
        cursor?: string;
        limit?: number;
      }): Promise<{
        activities: Array<{
          user_id: string;
          festival_id: string;
          activity_type:
            | "beer_count_update"
            | "tent_checkin"
            | "photo_upload"
            | "group_join"
            | "achievement_unlock";
          activity_data: Record<string, unknown>;
          activity_time: string;
          username: string;
          full_name: string;
          avatar_url: string | null;
        }>;
        nextCursor: string | null;
        hasMore: boolean;
      }> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ festivalId: query.festivalId });
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit) params.set("limit", query.limit.toString());

        const response = await fetch(`${baseUrl}/v1/activity-feed?${params}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch activity feed: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Notifications API
     */
    notifications: {
      async registerToken(token: string): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/notifications/token`, {
          method: "POST",
          headers,
          body: JSON.stringify({ token }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to register FCM token");
        }
        return parseJsonResponse(response);
      },

      async subscribe(data: {
        email?: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
      }): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/notifications/subscribe`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to subscribe user");
        }
        return parseJsonResponse(response);
      },

      async getPreferences(): Promise<{
        userId: string;
        pushEnabled: boolean | null;
        groupJoinEnabled: boolean | null;
        checkinEnabled: boolean | null;
        remindersEnabled: boolean | null;
        achievementNotificationsEnabled: boolean | null;
        groupNotificationsEnabled: boolean | null;
        createdAt: string;
        updatedAt: string | null;
      } | null> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/notifications/preferences`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch notification preferences: ${response.statusText}`
          );
        }
        return parseJsonResponse(response);
      },

      async updatePreferences(data: {
        pushEnabled?: boolean;
        groupJoinEnabled?: boolean;
        checkinEnabled?: boolean;
        remindersEnabled?: boolean;
        achievementNotificationsEnabled?: boolean;
        groupNotificationsEnabled?: boolean;
      }): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/notifications/preferences`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update preferences");
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Wrapped API
     */
    wrapped: {
      async get(festivalId: string): Promise<{
        wrapped: {
          userId: string;
          festivalId: string;
          totalDays: number;
          totalBeers: number;
          totalSpent: number;
          avgBeersPerDay: number;
          favoriteTent: { id: string; name: string; visitCount: number } | null;
          topDrinkType: string | null;
          achievements: Array<{ id: string; name: string; unlockedAt: string }>;
          globalRank: number | null;
          groupRanks: Array<{ groupId: string; groupName: string; rank: number }>;
          firstVisitDate: string | null;
          lastVisitDate: string | null;
          longestStreak: number;
          generatedAt: string;
        } | null;
        cached: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/wrapped/${festivalId}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch wrapped data: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },

      async generate(
        festivalId: string,
        force = false
      ): Promise<{
        wrapped: {
          userId: string;
          festivalId: string;
          totalDays: number;
          totalBeers: number;
          totalSpent: number;
          avgBeersPerDay: number;
          favoriteTent: { id: string; name: string; visitCount: number } | null;
          topDrinkType: string | null;
          achievements: Array<{ id: string; name: string; unlockedAt: string }>;
          globalRank: number | null;
          groupRanks: Array<{ groupId: string; groupName: string; rank: number }>;
          firstVisitDate: string | null;
          lastVisitDate: string | null;
          longestStreak: number;
          generatedAt: string;
        };
        regenerated: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/wrapped/${festivalId}/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify({ force }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to generate wrapped data");
        }
        return parseJsonResponse(response);
      },

      async checkAccess(festivalId: string): Promise<{
        allowed: boolean;
        reason?: "not_ended" | "no_data" | "not_authenticated" | "error";
        message?: string;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/wrapped/${festivalId}/access`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to check wrapped access: ${response.statusText}`);
        }
        return parseJsonResponse(response);
      },

      async getAvailableFestivals(): Promise<{
        festivals: Array<{
          id: string;
          name: string;
          year: number;
          status: string;
          hasData: boolean;
        }>;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/wrapped/festivals`, { headers });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch available wrapped festivals: ${response.statusText}`
          );
        }
        return parseJsonResponse(response);
      },

      async regenerateCache(data?: {
        festivalId?: string;
        userId?: string;
      }): Promise<{
        success: boolean;
        regeneratedCount?: number;
        error?: string;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/wrapped/regenerate`, {
          method: "POST",
          headers,
          body: JSON.stringify(data || {}),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to regenerate wrapped cache");
        }
        return parseJsonResponse(response);
      },
    },

    /**
     * Photos API
     */
    photos: {
      async getGlobalSettings(): Promise<{
        userId: string;
        hidePhotosFromAllGroups: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/settings/global`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch global photo settings: ${response.statusText}`
          );
        }
        return parseJsonResponse(response);
      },

      async updateGlobalSettings(data: {
        hidePhotosFromAllGroups: boolean;
      }): Promise<{ userId: string; hidePhotosFromAllGroups: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/settings/global`, {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update global photo settings");
        }
        return parseJsonResponse(response);
      },

      async getAllGroupSettings(): Promise<{
        settings: Array<{
          userId: string;
          groupId: string;
          groupName: string;
          hidePhotosFromGroup: boolean;
        }>;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/settings/groups`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch group photo settings: ${response.statusText}`
          );
        }
        return parseJsonResponse(response);
      },

      async getGroupSettings(groupId: string): Promise<{
        userId: string;
        groupId: string;
        groupName: string;
        hidePhotosFromGroup: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${baseUrl}/v1/photos/settings/groups/${groupId}`,
          { headers }
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch group photo settings: ${response.statusText}`
          );
        }
        return parseJsonResponse(response);
      },

      async updateGroupSettings(
        groupId: string,
        data: { hidePhotosFromGroup: boolean }
      ): Promise<{
        userId: string;
        groupId: string;
        hidePhotosFromGroup: boolean;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${baseUrl}/v1/photos/settings/groups/${groupId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(data),
          }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update group photo settings");
        }
        return parseJsonResponse(response);
      },

      async updateVisibility(
        photoId: string,
        visibility: "public" | "private"
      ): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/${photoId}/visibility`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ visibility }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update photo visibility");
        }
        return parseJsonResponse(response);
      },

      async bulkUpdateVisibility(
        photoIds: string[],
        visibility: "public" | "private"
      ): Promise<{ success: boolean; updatedCount: number }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/visibility`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ photoIds, visibility }),
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to update photos visibility");
        }
        return parseJsonResponse(response);
      },

      /**
       * Get a signed upload URL for uploading a photo
       */
      async getUploadUrl(params: {
        festivalId: string;
        attendanceId: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }): Promise<{
        uploadUrl: string;
        publicUrl: string;
        pictureId: string;
        expiresIn: number;
      }> {
        const headers = await getAuthHeaders();
        const queryParams = new URLSearchParams({
          festivalId: params.festivalId,
          attendanceId: params.attendanceId,
          fileName: params.fileName,
          fileType: params.fileType,
          fileSize: params.fileSize.toString(),
        });
        const response = await fetch(
          `${baseUrl}/v1/photos/upload-url?${queryParams}`,
          { headers }
        );
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to get photo upload URL");
        }
        return parseJsonResponse(response);
      },

      /**
       * Confirm that a photo was successfully uploaded
       */
      async confirmUpload(pictureId: string): Promise<{
        id: string;
        pictureUrl: string;
      }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/${pictureId}/confirm`, {
          method: "POST",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to confirm photo upload");
        }
        // API returns { success, picture: { id, url, attendanceId, uploadedAt } }
        // Transform to the expected format
        const result = await parseJsonResponse<{
          success: boolean;
          picture: { id: string; url: string };
        }>(response);
        return {
          id: result.picture.id,
          pictureUrl: result.picture.url,
        };
      },

      /**
       * List user's photos
       */
      async list(festivalId?: string): Promise<{
        photos: Array<{
          id: string;
          pictureUrl: string;
          visibility: "public" | "private";
          createdAt: string;
          attendanceId: string;
        }>;
        total: number;
      }> {
        const headers = await getAuthHeaders();
        const url = festivalId
          ? `${baseUrl}/v1/photos?festivalId=${festivalId}`
          : `${baseUrl}/v1/photos`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error("Failed to fetch photos");
        }
        return parseJsonResponse(response);
      },

      /**
       * Delete a photo
       */
      async delete(pictureId: string): Promise<{ success: boolean }> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${baseUrl}/v1/photos/${pictureId}`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          const error = await parseJsonResponse<{ message?: string }>(response).catch(
            () => ({ message: undefined })
          );
          throw new Error(error.message || "Failed to delete photo");
        }
        return parseJsonResponse(response);
      },
    },
  };
}

/** Type of the typed API client */
export type TypedApiClient = ReturnType<typeof createTypedApiClient>;
