/**
 * Activity feed hooks - re-exports from shared package
 *
 * These hooks use the ApiClientContext to access the API client.
 * The ApiClientProvider is set up in lib/data/query-client.tsx
 */

export {
  type ActivityFeedItem,
  type ActivityFeedResponse,
  useActivityFeed,
  useActivityFeedItems,
} from "@prostcounter/shared/hooks";
