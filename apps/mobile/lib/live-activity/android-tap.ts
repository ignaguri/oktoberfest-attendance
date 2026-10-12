import type { LiveActivityState } from "@prostcounter/shared/schemas";
import { countsAsBeer, formatDateForDatabase } from "@prostcounter/shared/utils";

import { ApiError, AuthRequiredError } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import type { PendingTap } from "@/modules/live-activity";
import type { AndroidSurface } from "@/modules/live-activity/src/android";

export interface AndroidTapDeps {
  surface: {
    read(): Promise<AndroidSurface | null>;
    render(state: LiveActivityState, appliedAt?: number): Promise<void>;
    end(): Promise<void>;
    appendPending(tap: PendingTap): Promise<void>;
    peekPending(): Promise<PendingTap[]>;
    removePending(ids: string[]): Promise<void>;
  };
  logDrink(tap: PendingTap): Promise<{ drinkCount: number; beerCount: number }>;
  /** The session's user, or null when the headless task has none. */
  currentUserId(): Promise<string | null>;
  now(): Date;
  newId(): string;
}

type FlushResult = {
  latest: { drinkCount: number; beerCount: number } | null;
  remaining: PendingTap[];
  message: LiveActivityState["message"];
  rejected: PendingTap[];
};

/** Sends pending taps oldest first; stops at the first one that can't go now. */
async function flushPending(
  deps: AndroidTapDeps,
  current: { festivalId: string; date: string } | null,
  userId: string | null,
): Promise<FlushResult> {
  // Taps left over from another day are still sent, but never change what is shown.
  const isCurrent = (tap: PendingTap) =>
    current !== null && tap.festivalId === current.festivalId && tap.date === current.date;
  const queue = await deps.surface.peekPending();
  let latest: FlushResult["latest"] = null;
  let message: FlushResult["message"] = null;
  const rejected: PendingTap[] = [];
  const sent: string[] = [];

  for (const tap of queue) {
    // Never post one account's taps under another's session.
    if (userId !== null && tap.userId !== userId) {
      logger.warn("[LiveActivity] dropping a tap queued by another account");
      sent.push(tap.consumptionId);
      continue;
    }
    try {
      const result = await deps.logDrink(tap);
      if (isCurrent(tap)) {
        latest = result;
      }
      sent.push(tap.consumptionId);
    } catch (error) {
      if (
        error instanceof AuthRequiredError ||
        (error instanceof ApiError && error.statusCode === 401)
      ) {
        message = message ?? "openAppToSync";
        break;
      }
      if (error instanceof ApiError && (error.statusCode === 408 || error.statusCode === 429)) {
        break;
      }
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        logger.warn("[LiveActivity] dropping a rejected tap", {
          status: error.statusCode,
          code: error.code,
        });
        sent.push(tap.consumptionId);
        if (isCurrent(tap)) {
          rejected.push(tap);
          if (error.code === "DATE_OUTSIDE_FESTIVAL") {
            message = "festivalEnded";
          } else if (message !== "festivalEnded") {
            message = "notLogged";
          }
        }
        continue;
      }
      break;
    }
  }

  await deps.surface.removePending(sent);
  const remaining = queue.filter((tap) => !sent.includes(tap.consumptionId) && isCurrent(tap));
  return { latest, remaining, message, rejected };
}

function withPending(
  base: LiveActivityState,
  totals: { drinkCount: number; beerCount: number },
  remaining: PendingTap[],
  message: LiveActivityState["message"],
): LiveActivityState {
  return {
    ...base,
    drinkCount: totals.drinkCount + remaining.length,
    beerCount: totals.beerCount + remaining.filter((tap) => countsAsBeer(tap.drinkType)).length,
    pendingCount: remaining.length,
    message,
  };
}

async function tap(deps: AndroidTapDeps): Promise<void> {
  const surface = await deps.surface.read();
  if (!surface) {
    return;
  }
  const { attributes, state } = surface;
  const now = deps.now();

  if (formatDateForDatabase(now, attributes.timezone) !== attributes.date) {
    await deps.surface.end();
    return;
  }

  // Offline with an expired token there is no session; the surface knows its owner.
  const userId = (await deps.currentUserId()) ?? surface.userId ?? null;
  if (!userId) {
    await deps.surface.render({ ...state, message: "openAppToSync" });
    return;
  }

  const newTap: PendingTap = {
    userId,
    consumptionId: deps.newId(),
    festivalId: attributes.festivalId,
    date: attributes.date,
    drinkType: state.lastDrinkType,
    tentId: state.lastTentId,
    tappedAt: now.toISOString(),
  };
  await deps.surface.appendPending(newTap);

  const optimistic: LiveActivityState = {
    ...state,
    drinkCount: state.drinkCount + 1,
    beerCount: state.beerCount + (countsAsBeer(newTap.drinkType) ? 1 : 0),
    pendingCount: state.pendingCount + 1,
    lastLogAt: newTap.tappedAt,
    message: null,
  };
  await deps.surface.render(optimistic);

  const { latest, remaining, message, rejected } = await flushPending(deps, attributes, userId);
  if (message === "festivalEnded") {
    await deps.surface.end();
    return;
  }

  if (latest) {
    // No appliedAt stamp: it would compare the device clock with the server's push times.
    await deps.surface.render(withPending(optimistic, latest, remaining, message));
    return;
  }

  // Nothing reached the server: keep the optimistic count minus rejected taps.
  const rejectedBeers = rejected.filter((t) => countsAsBeer(t.drinkType)).length;
  await deps.surface.render({
    ...optimistic,
    drinkCount: Math.max(0, optimistic.drinkCount - rejected.length),
    beerCount: Math.max(0, optimistic.beerCount - rejectedBeers),
    pendingCount: remaining.length,
    message,
  });
}

let chain: Promise<void> = Promise.resolve();

/** Runs work one after another so pending-queue writes and renders never race. */
export function runSerialized<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

export function handleAndroidTap(deps: AndroidTapDeps): Promise<void> {
  return runSerialized(() => tap(deps));
}

export function applyServerState(
  deps: AndroidTapDeps,
  state: LiveActivityState | null,
  timestamp?: number,
  forUserId?: string,
): Promise<void> {
  return runSerialized(() => applyState(deps, state, timestamp, forUserId));
}

async function applyState(
  deps: AndroidTapDeps,
  state: LiveActivityState | null,
  timestamp?: number,
  forUserId?: string,
): Promise<void> {
  const surface = await deps.surface.read();
  // The push token belongs to the device, so a previous account's row can still reach it.
  if (forUserId && surface?.userId && forUserId !== surface.userId) {
    return;
  }
  // Data pushes arrive in any order; an older one would roll the count back.
  const appliedAt = surface?.appliedAt;
  if (timestamp !== undefined && appliedAt !== undefined && timestamp < appliedAt) {
    return;
  }
  if (!state) {
    await deps.surface.end();
    return;
  }
  const userId = (await deps.currentUserId()) ?? surface?.userId ?? null;
  const { latest, remaining, message } = await flushPending(
    deps,
    surface?.attributes ?? null,
    userId,
  );
  if (message === "festivalEnded") {
    await deps.surface.end();
    return;
  }
  const totals = latest ?? {
    drinkCount: state.drinkCount,
    beerCount: state.beerCount,
  };
  await deps.surface.render(withPending(state, totals, remaining, message), timestamp);
}
