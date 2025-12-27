"use client";

import {
  isPWAInstalled,
  isIOS,
  supportsBeforeInstallPrompt,
} from "@/lib/utils";
import { useState, useEffect, useCallback, startTransition } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallPWAEvent =
  | { type: "prompt_shown"; promptCount: number }
  | { type: "install_clicked" }
  | { type: "install_success" }
  | { type: "install_dismissed" }
  | { type: "install_error"; error: string }
  | { type: "prompt_closed_manually" }
  | { type: "ios_instructions_shown" };

const MAX_PROMPT_COUNT = 3;

function trackInstallPWAEvent(event: InstallPWAEvent): void {
  if (typeof window !== "undefined" && "gtag" in window) {
    const gtag = (window as any).gtag;

    switch (event.type) {
      case "prompt_shown":
        gtag("event", "pwa_prompt_shown", {
          event_category: "PWA",
          event_label: "Install Prompt Displayed",
          value: event.promptCount,
          custom_parameters: {
            prompt_count: event.promptCount,
          },
        });
        break;

      case "install_clicked":
        gtag("event", "pwa_install_clicked", {
          event_category: "PWA",
          event_label: "Install Button Clicked",
        });
        break;

      case "install_success":
        gtag("event", "pwa_install_success", {
          event_category: "PWA",
          event_label: "App Successfully Installed",
          value: 1,
        });
        break;

      case "install_dismissed":
        gtag("event", "pwa_install_dismissed", {
          event_category: "PWA",
          event_label: "Install Prompt Dismissed",
        });
        break;

      case "install_error":
        gtag("event", "pwa_install_error", {
          event_category: "PWA",
          event_label: "Install Failed",
          custom_parameters: {
            error_message: event.error,
          },
        });
        break;

      case "prompt_closed_manually":
        gtag("event", "pwa_prompt_closed", {
          event_category: "PWA",
          event_label: "Prompt Closed Manually",
        });
        break;

      case "ios_instructions_shown":
        gtag("event", "pwa_ios_instructions_shown", {
          event_category: "PWA",
          event_label: "iOS Install Instructions Shown",
        });
        break;
    }
  }
}

interface UseInstallPWAOptions {
  enableAutoShow?: boolean;
  onPromptShow?: () => void;
  onInstallSuccess?: () => void;
  onPromptClose?: () => void;
}

export function useInstallPWA(options: UseInstallPWAOptions = {}) {
  const {
    enableAutoShow = false,
    onPromptShow,
    onInstallSuccess,
    onPromptClose,
  } = options;
  const [canInstall, setCanInstall] = useState(false);
  const [promptInstall, setPromptInstall] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  const getPromptCount = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const count = localStorage.getItem("pwaPromptCount");
    return count ? parseInt(count, 10) : 0;
  }, []);

  const incrementPromptCount = useCallback(() => {
    if (isInstalled || typeof window === "undefined") return;
    const currentCount = getPromptCount();
    if (currentCount < MAX_PROMPT_COUNT) {
      localStorage.setItem("pwaPromptCount", (currentCount + 1).toString());
    }
  }, [isInstalled, getPromptCount]);

  // Client-side hydration effect
  useEffect(() => {
    startTransition(() => {
      setIsClient(true);
    });
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const handler = (e: Event) => {
      const installEvent = e as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setPromptInstall(installEvent);

      const currentCount = getPromptCount();
      if (currentCount < MAX_PROMPT_COUNT) {
        setCanInstall(true);
        if (enableAutoShow) {
          setShouldShow(true);
          incrementPromptCount();
          trackInstallPWAEvent({
            type: "prompt_shown",
            promptCount: currentCount + 1,
          });
          onPromptShow?.();
        }
      }
    };

    const checkInstalled = () => {
      if (isPWAInstalled()) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    const checkPWASupport = () => {
      const promptCount = getPromptCount();

      // Check for iOS devices that support PWA but don't have beforeinstallprompt
      if (isIOS() && !isPWAInstalled() && promptCount < MAX_PROMPT_COUNT) {
        setCanInstall(true);
        setShowIOSInstructions(true);
        if (enableAutoShow) {
          setShouldShow(true);
          incrementPromptCount();
          trackInstallPWAEvent({ type: "ios_instructions_shown" });
          onPromptShow?.();
        }
        return;
      }

      // Check for browsers that support beforeinstallprompt
      if (supportsBeforeInstallPrompt() && promptCount < MAX_PROMPT_COUNT) {
        window.addEventListener("beforeinstallprompt", handler);
      }
    };

    // Run checks
    checkInstalled();
    checkPWASupport();

    // Set up event listeners
    window.addEventListener("appinstalled", checkInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", checkInstalled);
    };
  }, [
    isClient,
    enableAutoShow,
    onPromptShow,
    getPromptCount,
    incrementPromptCount,
  ]);

  const installPWA = useCallback(async () => {
    if (!promptInstall && !showIOSInstructions) {
      toast.error("Error", {
        description: "Installation not available on this device.",
      });
      trackInstallPWAEvent({
        type: "install_error",
        error: "No install prompt available",
      });
      return;
    }

    if (showIOSInstructions) {
      toast.info("Install Instructions", {
        description:
          "To install on iOS: Tap the Share button in Safari, then 'Add to Home Screen'.",
      });
      return;
    }

    try {
      trackInstallPWAEvent({ type: "install_clicked" });

      // Trigger the install prompt
      await promptInstall!.prompt();

      // Wait for user choice
      const result = await promptInstall!.userChoice;

      if (result.outcome === "accepted") {
        trackInstallPWAEvent({ type: "install_success" });
        toast.success("Success", {
          description: "App installed successfully!",
        });
        setCanInstall(false);
        onInstallSuccess?.();
      } else {
        trackInstallPWAEvent({ type: "install_dismissed" });
        toast.info("Installation cancelled", {
          description: "You can install the app later from this menu.",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      trackInstallPWAEvent({
        type: "install_error",
        error: errorMessage,
      });
      toast.error("Installation failed", {
        description: "Please try again later.",
      });
    }
  }, [promptInstall, showIOSInstructions, onInstallSuccess]);

  const closePrompt = useCallback(() => {
    trackInstallPWAEvent({ type: "prompt_closed_manually" });
    setShouldShow(false);
    onPromptClose?.();
  }, [onPromptClose]);

  return {
    canInstall,
    installPWA,
    showIOSInstructions,
    shouldShow,
    closePrompt,
    isInstalled,
  };
}
