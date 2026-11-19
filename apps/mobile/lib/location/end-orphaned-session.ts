import { ApiError, apiClient } from "@/lib/api-client";
import { clearLocationSessionId } from "@/lib/auth/secure-storage";
import { logger } from "@/lib/logger";

const NOT_FOUND = 404;

/**
 * Ends a server location session whose background task is gone.
 *
 * A headless wake stops the task but cannot end the session, and nothing else
 * would: the context never restores `activeSession`, so the user could not stop
 * it, and starting another one for the festival would conflict. The stored id
 * stays when the call fails (offline), so the next launch tries again.
 */
export async function endOrphanedLocationSession(sessionId: string): Promise<void> {
  try {
    await apiClient.location.stopSession(sessionId);
  } catch (error) {
    const alreadyGone = error instanceof ApiError && error.statusCode === NOT_FOUND;
    if (!alreadyGone) {
      logger.warn("Could not end orphaned location session, will retry", { error });
      return;
    }
  }

  await clearLocationSessionId();
}
