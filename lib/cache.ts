import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 3600 * 24 * 7, checkperiod: 120 }); // Default TTL of 1 week
const tagMap = new Map<string, Set<string>>(); // Map to store tags and their associated keys

// Set a value in the cache with optional tags
export function setCache<T>(key: string, value: T, tags: string[] = []): void {
  cache.set(key, value);
  tags.forEach((tag) => {
    if (!tagMap.has(tag)) {
      tagMap.set(tag, new Set());
    }
    tagMap.get(tag)!.add(key);
  });
}

// Get a value from the cache
export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

// Delete a value from the cache
export function deleteCache(key: string): void {
  cache.del(key);
  // Remove the key from all tags
  tagMap.forEach((keys, tag) => {
    keys.delete(key);
    if (keys.size === 0) {
      tagMap.delete(tag);
    }
  });
}

// Clear the entire cache
export function clearCache(): void {
  cache.flushAll();
  tagMap.clear();
}

// Retrieve all cache keys
export function getCacheKeys(): string[] {
  return cache.keys();
}

// Clear all caches
export function clearAllCaches(): void {
  cache.flushAll();
  tagMap.clear();
}

// Invalidate all cache entries associated with a tag
export function invalidateTag(tag: string): void {
  const keys = tagMap.get(tag);
  if (keys) {
    keys.forEach((key) => cache.del(key));
    tagMap.delete(tag);
  }
}

// Invalidate multiple tags
export function invalidateTags(tags: string[]): void {
  tags.forEach((tag) => invalidateTag(tag));
}
