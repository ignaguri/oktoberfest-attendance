import { logger } from "@/lib/logger";
import { useCallback, useEffect, useState } from "react";

interface VersionData {
  version: string;
  buildTime: string;
  changelog: string[];
  requiresUpdate: boolean;
  lastChecked: string;
}

interface UpdateState {
  isChecking: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  newVersion: string;
  changelog: string[];
  lastChecked: string;
}

export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isChecking: false,
    hasUpdate: false,
    currentVersion: "",
    newVersion: "",
    changelog: [],
    lastChecked: "",
  });

  const checkForUpdates = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    setUpdateState((prev) => ({ ...prev, isChecking: true }));

    try {
      // Check with our API
      const response = await fetch("/api/version");
      const versionData: VersionData = await response.json();

      // Send message to service worker to check for updates
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CHECK_FOR_UPDATES",
          currentVersion: versionData.version,
        });
      }

      setUpdateState((prev) => ({
        ...prev,
        isChecking: false,
        currentVersion: versionData.version,
        changelog: versionData.changelog,
        lastChecked: versionData.lastChecked,
      }));
    } catch (error) {
      logger.error(
        "Failed to check for updates",
        logger.clientComponent("useAppUpdate"),
        error as Error,
      );
      setUpdateState((prev) => ({ ...prev, isChecking: false }));
    }
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;

    // Send message to service worker to apply update
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "APPLY_UPDATE",
      });
    }

    // Reload the page to apply the update
    window.location.reload();
  }, []);

  const skipUpdate = useCallback(() => {
    setUpdateState((prev) => ({ ...prev, hasUpdate: false }));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_AVAILABLE") {
        setUpdateState((prev) => ({
          ...prev,
          hasUpdate: true,
          newVersion: event.data.newVersion,
        }));
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Check for updates when component mounts
    checkForUpdates();

    // Check for updates when app comes into focus
    const handleFocus = () => {
      checkForUpdates();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkForUpdates]);

  return {
    ...updateState,
    checkForUpdates,
    applyUpdate,
    skipUpdate,
  };
}
