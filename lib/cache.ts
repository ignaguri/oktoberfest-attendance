import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 3600 * 24 * 7, checkperiod: 120 }); // Default TTL of 1 week

// Set a value in the cache
export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

// Get a value from the cache
export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

// Delete a value from the cache
export function deleteCache(key: string): void {
  cache.del(key);
}

// Clear the entire cache
export function clearCache(): void {
  cache.flushAll();
}

// Retrieve all cache keys
export function getCacheKeys(): string[] {
  return cache.keys(); // Retrieve all cache keys
}

// Clear all caches
export function clearAllCaches(): void {
  cache.flushAll(); // Clear all caches
}
