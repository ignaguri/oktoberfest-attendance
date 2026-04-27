import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { clearAllData } from "@/lib/database/debug";
import { useOffline } from "@/lib/database/offline-provider";
import { invalidateAllLocalQueries } from "@/lib/database/query-keys";
import { logger } from "@/lib/logger";

export function useResyncFromServer() {
  const offline = useOffline();
  const queryClient = useQueryClient();
  const [isResyncing, setIsResyncing] = useState(false);

  const resync = useCallback(async () => {
    setIsResyncing(true);
    try {
      const db = offline.getDb();

      logger.debug("[Resync] Wiping local data");
      await clearAllData(db);

      logger.debug("[Resync] Pulling fresh data from server");
      const result = await offline.sync({ direction: "pull", force: true });

      if (!result.success) {
        throw new Error(result.errors[0] ?? "Sync failed");
      }

      await invalidateAllLocalQueries(queryClient);

      logger.debug("[Resync] Complete", { pulled: result.pulled });
    } finally {
      setIsResyncing(false);
    }
  }, [offline, queryClient]);

  return { resync, isResyncing };
}
