import { APP_VERSION } from "@/version";
import { useEffect, useState, useCallback, useRef } from "react";

interface VersionData {
  version: string;
  buildTime: string;
  changelog: string[];
  requiresUpdate: boolean;
  lastChecked: string;
}

interface UpdateState {
  isChecking: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  newVersion: string;
  changelog: string[];
  error: string | null;
}

export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isChecking: false,
    updateAvailable: false,
    currentVersion: APP_VERSION,
    newVersion: "",
    changelog: [],
    error: null,
  });

  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);
  const messagePort = useRef<MessagePort | null>(null);

  // Initialize service worker communication
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        swRegistration.current = registration;

        // Set up message channel for communication
        const channel = new MessageChannel();
        messagePort.current = channel.port1;

        // Listen for messages from service worker
        channel.port1.onmessage = (event) => {
          if (event.data.type === "VERSION_CHECK_RESULT") {
            const versionData: VersionData = event.data.data;
            checkForUpdates(versionData);
          } else if (event.data.type === "VERSION_CHECK_ERROR") {
            setUpdateState((prev) => ({
              ...prev,
              error: event.data.error,
              isChecking: false,
            }));
          }
        };

        // Send the port to the service worker
        registration.active?.postMessage({ type: "SET_MESSAGE_PORT" }, [
          channel.port2,
        ]);
      });
    }
  }, []);

  // Check for updates by comparing versions
  const checkForUpdates = useCallback((versionData: VersionData) => {
    const currentVersion = APP_VERSION;
    const newVersion = versionData.version;

    // Compare versions (assuming semantic versioning)
    const updateAvailable = currentVersion !== newVersion;

    setUpdateState((prev) => ({
      ...prev,
      isChecking: false,
      updateAvailable,
      newVersion: updateAvailable ? newVersion : "",
      changelog: updateAvailable ? versionData.changelog : [],
      error: null,
    }));
  }, []);

  // Check for updates manually
  const checkForUpdatesManually = useCallback(async () => {
    if (!swRegistration.current || !messagePort.current) return;

    setUpdateState((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      // Request immediate version check from service worker
      messagePort.current.postMessage({ type: "CHECK_FOR_UPDATES" });
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        isChecking: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check for updates",
      }));
    }
  }, []);

  // Apply the update
  const applyUpdate = useCallback(async () => {
    if (!swRegistration.current) return;

    try {
      // Skip waiting and claim clients for immediate update
      if (swRegistration.current.waiting) {
        swRegistration.current.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      // Reload the page to apply the update
      window.location.reload();
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to apply update",
      }));
    }
  }, []);

  // Check for updates when app comes into focus
  useEffect(() => {
    const handleFocus = () => {
      checkForUpdatesManually();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [checkForUpdatesManually]);

  // Initial check for updates
  useEffect(() => {
    checkForUpdatesManually();
  }, [checkForUpdatesManually]);

  return {
    ...updateState,
    checkForUpdates: checkForUpdatesManually,
    applyUpdate,
  };
}
