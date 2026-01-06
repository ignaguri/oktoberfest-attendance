"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n/client";
import { logger } from "@/lib/logger";
import { useState } from "react";
import { toast } from "sonner";

const CacheManagement = () => {
  const { t } = useTranslation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [userId, setUserId] = useState("");
  const [festivalId, setFestivalId] = useState("");

  const handleClearServiceWorkerCache = async () => {
    try {
      if ("serviceWorker" in navigator && "caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );

        // Update service worker
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.update()),
        );

        toast.success(t("notifications.success.swCacheCleared"));
      } else {
        toast.error(t("notifications.error.swNotSupported"));
      }
    } catch (error) {
      logger.error(
        "Error clearing service worker cache",
        logger.clientComponent("CacheManagement"),
        error as Error,
      );
      toast.error(t("notifications.error.swClearFailed"));
    }
  };

  const handleRegenerateWrappedCache = async () => {
    setIsRegenerating(true);
    try {
      const result = await apiClient.wrapped.regenerateCache({
        festivalId: festivalId || undefined,
        userId: userId || undefined,
      });

      if (result.success) {
        toast.success(
          `Successfully regenerated ${result.regeneratedCount || 0} wrapped cache entries`,
        );
        setUserId("");
        setFestivalId("");
      } else {
        toast.error(
          result.error || t("notifications.error.wrappedCacheRegenerateFailed"),
        );
      }
    } catch (error) {
      logger.error(
        "Error regenerating wrapped cache",
        logger.clientComponent("CacheManagement"),
        error as Error,
      );
      toast.error(t("notifications.error.wrappedCacheRegenerateFailed"));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Cache Management</h2>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            New Caching System
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            The old NodeCache system has been replaced with modern HTTP caching
            headers and Next.js unstable_cache for better performance and
            serverless compatibility.
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Images: HTTP headers with ETags and 30-day cache</li>
            <li>• Service Worker: Optimized PWA caching strategies</li>
            <li>• Database queries: Next.js unstable_cache for metadata</li>
          </ul>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={handleClearServiceWorkerCache}
            className="w-full sm:w-auto"
          >
            Clear Service Worker Caches
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            This will clear all PWA service worker caches and update the service
            worker.
          </p>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">
            Wrapped Data Cache
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300 mb-3">
            Wrapped data is automatically cached after first calculation. Use
            this tool to manually regenerate cached data for specific users or
            festivals.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="userId" className="text-sm font-medium">
                User ID (optional)
              </Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Leave empty to regenerate all users"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="festivalId" className="text-sm font-medium">
                Festival ID (optional)
              </Label>
              <Input
                id="festivalId"
                value={festivalId}
                onChange={(e) => setFestivalId(e.target.value)}
                placeholder="Leave empty to regenerate all festivals"
                className="mt-1"
              />
            </div>

            <Button
              onClick={handleRegenerateWrappedCache}
              disabled={isRegenerating}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate Wrapped Cache"}
            </Button>

            <p className="text-sm text-muted-foreground">
              This will recalculate and cache wrapped data for the specified
              user(s) and festival(s). Leave both fields empty to regenerate all
              cached data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheManagement;
