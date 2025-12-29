import { createSupabaseBrowserClient } from "@/utils/supabase/client";

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
    }) {
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
      return response.json();
    },

    /**
     * Delete an attendance record
     */
    async delete(attendanceId: string) {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/attendance/${attendanceId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete attendance");
      }
      return response.json();
    },
  },

  /**
   * Groups API
   */
  groups: {
    /**
     * List user's groups
     */
    async list(query?: { festivalId?: string }) {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams(
        query?.festivalId ? { festivalId: query.festivalId } : {},
      );
      const url = `${API_BASE_URL}/v1/groups?${params}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
      }
      return response.json();
    },

    /**
     * Get group details
     */
    async get(groupId: string) {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups/${groupId}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch group: ${response.statusText}`);
      }
      return response.json();
    },

    /**
     * Create a new group
     */
    async create(data: {
      name: string;
      festivalId: string;
      winningCriteria?: string;
    }) {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/v1/groups`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create group");
      }
      return response.json();
    },

    /**
     * Join a group
     */
    async join(groupId: string, inviteToken?: string) {
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
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to join group");
      }
      return response.json();
    },

    /**
     * Leave a group
     */
    async leave(groupId: string) {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/v1/groups/${groupId}/leave`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to leave group");
      }
      return response.json();
    },
  },
};
