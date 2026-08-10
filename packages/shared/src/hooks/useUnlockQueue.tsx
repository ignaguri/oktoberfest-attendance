"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { PersistedUnlock } from "../achievements";
import { mergeUnlocks } from "../achievements";
import { QueryKeys, useApiClient, useQuery } from "../data";

interface UnlockQueueValue {
  /** Everything waiting to be shown. Empty most of the time. */
  batch: PersistedUnlock[];
  /** Hand unlocks straight from a mutation response to the queue. */
  push: (unlocks: PersistedUnlock[]) => void;
  /** Acks the current batch server-side and clears it. Call when the toast renders. */
  consume: () => void;
}

const UnlockQueueContext = createContext<UnlockQueueValue | null>(null);

/**
 * Collects achievement unlocks from both delivery paths and hands them to the
 * platform's toast host as one deduped batch.
 *
 * Inline: write paths that return `unlocked[]` push directly, so the toast lands
 * in the same tick as the mutation.
 *
 * Pending: everything else — including unlocks with no live request behind them,
 * like the activity middleware and the standings job — arrives through
 * GET /achievements/pending. That query has no interval; it refetches on window
 * focus and when a mutation invalidates it.
 */
export function UnlockQueueProvider({ children }: { children: ReactNode }) {
  const apiClient = useApiClient();
  const [batch, setBatch] = useState<PersistedUnlock[]>([]);

  const { data: pending } = useQuery(
    QueryKeys.pendingUnlocks(),
    async () => {
      const response = await apiClient.achievements.pending();
      return response.data ?? [];
    },
    {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  );

  const push = useCallback((unlocks: PersistedUnlock[]) => {
    if (unlocks.length === 0) {
      return;
    }
    setBatch((current) => mergeUnlocks(current, unlocks));
  }, []);

  useEffect(() => {
    if (pending && pending.length > 0) {
      setBatch((current) => mergeUnlocks(current, pending));
    }
  }, [pending]);

  const consume = useCallback(() => {
    setBatch((current) => {
      if (current.length === 0) {
        return current;
      }

      const eventIds = current.map((entry) => entry.eventId);
      // Acked on display, not dismissal: an unacked event is re-pushed by the
      // notification sweep, and a user who never dismisses would be pushed
      // every time it runs. A lost ack costs one redundant push instead.
      void apiClient.achievements.markSeen(eventIds).catch(() => {
        // Swallowed deliberately. The sweep's ten-minute delay is the backstop,
        // and surfacing a failed ack to the user would be noise about a
        // celebration they already saw.
      });

      return [];
    });
  }, [apiClient]);

  const value = useMemo(() => ({ batch, push, consume }), [batch, push, consume]);

  return <UnlockQueueContext.Provider value={value}>{children}</UnlockQueueContext.Provider>;
}

export function useUnlockQueue(): UnlockQueueValue {
  const context = useContext(UnlockQueueContext);
  if (!context) {
    throw new Error("useUnlockQueue must be used within an UnlockQueueProvider");
  }
  return context;
}
