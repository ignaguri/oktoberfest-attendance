"use client";

import { RotateCcw } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { isPWAInstalled } from "@/lib/utils";

export function PWAReloadButton() {
  const [isPWA, setIsPWA] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    startTransition(() => {
      setIsPWA(isPWAInstalled());
    });
  }, []);

  const handleReload = async () => {
    if (isReloading) return;

    setIsReloading(true);

    try {
      // Clear service worker caches
      if ("serviceWorker" in navigator && "caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }

      // Update service worker
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.update()),
        );
      }

      // Reload the page with cache bypass
      window.location.reload();
    } catch (error) {
      logger.error(
        "Error during PWA reload",
        logger.clientComponent("PWAReloadButton"),
        error as Error,
      );
      // Fallback to regular reload
      window.location.reload();
    }
  };

  // Only show in PWA mode
  if (!isPWA) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleReload}
      disabled={isReloading}
      className="h-8 w-8 text-white hover:bg-gray-700"
      title="Refresh app and clear cache"
    >
      <RotateCcw className={`h-4 w-4 ${isReloading ? "animate-spin" : ""}`} />
    </Button>
  );
}
