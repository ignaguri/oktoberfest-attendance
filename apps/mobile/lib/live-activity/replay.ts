import { ApiError, AuthRequiredError } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import type { PendingTap } from "@/modules/live-activity";

export interface ReplayDeps {
  /** The signed-in user; taps queued by anyone else are dropped, never sent. */
  userId: string;
  peek(): Promise<PendingTap[]>;
  remove(ids: string[]): Promise<void>;
  logDrink(tap: PendingTap): Promise<unknown>;
}

/**
 * Replays lock-screen taps saved while offline. Each keeps its consumptionId,
 * so a tap the server already stored comes back 200 instead of a second drink.
 */
export async function replayPendingTaps(
  deps: ReplayDeps,
): Promise<{ sent: number; dropped: number; kept: number }> {
  const queue = await deps.peek();
  const done: string[] = [];
  let sent = 0;

  const foreign = queue.filter((tap) => tap.userId !== deps.userId);
  if (foreign.length > 0) {
    logger.warn("[LiveActivity] dropping taps queued by another account", {
      count: foreign.length,
    });
    done.push(...foreign.map((tap) => tap.consumptionId));
  }

  for (const tap of queue.filter((queued) => queued.userId === deps.userId)) {
    try {
      await deps.logDrink(tap);
      done.push(tap.consumptionId);
      sent += 1;
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        break;
      }
      if (error instanceof ApiError) {
        const { statusCode } = error;
        // 401, 408 and 429 are retryable: keep the tap. Other 4xx will never succeed: drop it.
        const retryable = statusCode === 401 || statusCode === 408 || statusCode === 429;
        if (!retryable && statusCode >= 400 && statusCode < 500) {
          logger.warn("[LiveActivity] dropping a rejected tap", {
            status: statusCode,
            code: error.code,
          });
          done.push(tap.consumptionId);
          continue;
        }
      }
      break;
    }
  }

  if (done.length > 0) {
    await deps.remove(done);
  }
  return { sent, dropped: done.length - sent, kept: queue.length - done.length };
}
