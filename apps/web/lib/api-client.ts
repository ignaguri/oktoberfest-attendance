/**
 * API client for Next.js web app
 *
 * Uses the shared typed client factory from @prostcounter/api-client
 * with platform-specific auth configuration.
 */

import {
  ApiError,
  type ApiHeaders,
  createTypedApiClient,
  type TypedApiClient,
} from "@prostcounter/api-client";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";

// Re-export ApiError for convenience
export { ApiError };

// Re-export ApiResponse type
export type { TypedApiResponse as ApiResponse } from "@prostcounter/api-client";

/**
 * Base URL for API requests
 * Uses relative URL by default, which works for any deployment (local, preview, production)
 * Set NEXT_PUBLIC_API_URL for explicit override (e.g., external API server)
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Get auth headers for API requests using Supabase browser client
 */
async function getAuthHeaders(): Promise<ApiHeaders> {
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
 * Type-safe API client instance for the web app
 */
const baseClient = createTypedApiClient({
  baseUrl: API_BASE_URL,
  getAuthHeaders,
});

/**
 * Extended API client with web-specific methods (like photo upload with FormData)
 */
export const apiClient: TypedApiClient & {
  photos: TypedApiClient["photos"] & {
    upload: (data: {
      picture: File;
      attendanceId: string;
      visibility: "public" | "private";
    }) => Promise<{
      success: boolean;
      pictureUrl: string;
      message: string;
    }>;
  };
} = {
  ...baseClient,
  photos: {
    ...baseClient.photos,
    /**
     * Upload a photo with server-side Sharp compression
     * Uses Next.js API route for image processing
     * This method is web-specific due to FormData and File handling
     */
    async upload(data: {
      picture: File;
      attendanceId: string;
      visibility: "public" | "private";
    }): Promise<{
      success: boolean;
      pictureUrl: string;
      message: string;
    }> {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("picture", data.picture);
      formData.append("attendanceId", data.attendanceId);
      formData.append("visibility", data.visibility);

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}/photos/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const code = errorData.error?.code || "PHOTO_UPLOAD_FAILED";
        const message = errorData.error?.message || "Failed to upload photo";
        throw new ApiError(code, message, response.status);
      }

      return response.json();
    },
  },
};
