"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { logger } from "@/lib/logger";

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
          t("notifications.success.wrappedCacheRegenerated", {
            count: result.regeneratedCount || 0,
          }),
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
      <h2 className="mb-4 text-xl font-semibold">{t("admin.cache.title")}</h2>
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="mb-2 font-medium text-blue-900 dark:text-blue-100">
            {t("admin.cache.serviceWorker.title")}
          </h3>
          <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
            {t("admin.cache.serviceWorker.description")}
          </p>
          <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
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
            {t("admin.cache.serviceWorker.button")}
          </Button>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("admin.cache.serviceWorker.help")}
          </p>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <h3 className="mb-2 font-medium text-green-900 dark:text-green-100">
            {t("admin.cache.wrappedData.title")}
          </h3>
          <p className="mb-3 text-sm text-green-700 dark:text-green-300">
            {t("admin.cache.wrappedData.description")}
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="userId" className="text-sm font-medium">
                {t("admin.cache.wrappedData.form.userId")}
              </Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={t(
                  "admin.cache.wrappedData.form.userIdPlaceholder",
                )}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="festivalId" className="text-sm font-medium">
                {t("admin.cache.wrappedData.form.festivalId")}
              </Label>
              <Input
                id="festivalId"
                value={festivalId}
                onChange={(e) => setFestivalId(e.target.value)}
                placeholder={t(
                  "admin.cache.wrappedData.form.festivalIdPlaceholder",
                )}
                className="mt-1"
              />
            </div>

            <Button
              onClick={handleRegenerateWrappedCache}
              disabled={isRegenerating}
              className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
            >
              {isRegenerating
                ? t("admin.cache.wrappedData.buttons.regenerating")
                : t("admin.cache.wrappedData.buttons.regenerate")}
            </Button>

            <p className="text-muted-foreground text-sm">
              {t("admin.cache.wrappedData.help")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheManagement;
