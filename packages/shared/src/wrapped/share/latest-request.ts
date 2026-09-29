/**
 * Per-key request counter for async loads: begin(key) returns an isStale()
 * check that turns true once a newer request for the same key has started.
 */
export function createLatestRequestGate<Key extends string>() {
  const latest: Partial<Record<Key, number>> = {};
  return (key: Key) => {
    const request = (latest[key] ?? 0) + 1;
    latest[key] = request;
    return () => latest[key] !== request;
  };
}
