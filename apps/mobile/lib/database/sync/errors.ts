/**
 * Sync Error Helpers
 */

/** Normalises a thrown value into the message stored on PullResult.error. */
export function pullErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
