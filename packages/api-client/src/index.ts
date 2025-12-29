/**
 * Type-safe API client for ProstCounter
 * Auto-generated from OpenAPI spec
 *
 * Usage:
 * ```ts
 * import { createApiClient } from '@prostcounter/api-client';
 *
 * const client = createApiClient({
 *   baseUrl: 'http://localhost:3008/api',
 *   getAuthToken: async () => {
 *     const session = await getSession();
 *     return session?.access_token;
 *   }
 * });
 *
 * const data = await client.GET('/health');
 * ```
 */

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | undefined>;
}

/**
 * Create a type-safe API client
 * Will be implemented once we have actual API routes
 */
export function createApiClient(config: ApiClientConfig) {
  return {
    config,
    // TODO: Implement fetch methods once OpenAPI spec has routes
  };
}

// Export types for external use
export type * from "./generated";
