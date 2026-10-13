/**
 * Signed out or not allowed: an expected outcome, so neither app reports it to
 * Sentry. Other 4xx (validation, not found, conflict) can mean client/API drift
 * and still get reported.
 */
export function isExpectedAuthStatus(status: unknown): boolean {
  return status === 401 || status === 403;
}
