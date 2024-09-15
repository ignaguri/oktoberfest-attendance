import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // Default TTL of 1 hour

// Set a value in the cache
export function setCache<T>(key: string, value: T, ttl: number = 3600): void {
  cache.set(key, value, ttl);
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
