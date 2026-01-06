/**
 * Type-safe API client for ProstCounter
 * Auto-generated types from OpenAPI spec
 */

import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./generated";

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | undefined>;
}

/**
 * Create a low-level OpenAPI client for ProstCounter API
 *
 * For most use cases, prefer `createTypedApiClient` which provides
 * higher-level convenience methods.
 *
 * @example
 * ```ts
 * import { createApiClient } from '@prostcounter/api-client';
 *
 * const client = createApiClient({
 *   baseUrl: '/api',
 *   getAuthToken: async () => {
 *     const { data } = await supabase.auth.getSession();
 *     return data.session?.access_token;
 *   }
 * });
 *
 * // Fully typed request and response
 * const { data, error } = await client.GET('/v1/groups', {
 *   params: { query: { festivalId: '...' } }
 * });
 * ```
 */
export function createApiClient(config: ApiClientConfig) {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
  });

  // Add auth middleware if getAuthToken is provided
  if (config.getAuthToken) {
    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const token = await config.getAuthToken!();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        return request;
      },
    };
    client.use(authMiddleware);
  }

  return client;
}

// Re-export types for external use
export type { paths } from "./generated";
export type { components } from "./generated";

// Export the client type for typing purposes
export type ApiClient = ReturnType<typeof createApiClient>;

// Utility types for extracting request/response types
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;

export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends {
  requestBody?: { content: { "application/json": infer T } };
}
  ? T
  : never;

export type ApiQueryParams<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { parameters: { query: infer T } } ? T : never;

// Export typed client factory and types
export {
  createTypedApiClient,
  ApiError,
  type ApiClientConfig as TypedApiClientConfig,
  type ApiResponse as TypedApiResponse,
  type TypedApiClient,
  type ApiHeaders,
} from "./typed-client";
