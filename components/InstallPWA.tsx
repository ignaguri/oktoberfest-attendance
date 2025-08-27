"use client";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";
import { X, Share, SquarePlus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

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

function isPWAInstalled(): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
    if (
      "standalone" in window.navigator &&
      (window.navigator as any).standalone === true
    ) {
      return true;
    }
    if (document.referrer.includes("android-app://")) {
      return true;
    }
  }
  return false;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "BeforeInstallPromptEvent" in window || "onbeforeinstallprompt" in window
  );
}

export default function InstallPWA() {
  const { setInstallPWAVisible, canShowInstallPWA } = useNotifications();
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hide, setHide] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const getPromptCount = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const count = localStorage.getItem("pwaPromptCount");
    return count ? parseInt(count, 10) : 0;
  }, []);

  const incrementPromptCount = useCallback(() => {
    if (hide || isInstalled || typeof window === "undefined") return;

    const currentCount = getPromptCount();
    if (currentCount < MAX_PROMPT_COUNT) {
      localStorage.setItem("pwaPromptCount", (currentCount + 1).toString());
    }
  }, [hide, isInstalled, getPromptCount]);

  // Client-side hydration effect
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const handler = (e: Event) => {
      const installEvent = e as BeforeInstallPromptEvent;
      installEvent.preventDefault();

      // InstallPWA has priority - show immediately if we can
      if (canShowInstallPWA) {
        setSupportsPWA(true);
        setIsOpen(true);
        setInstallPWAVisible(true);
        setPromptInstall(installEvent);

        const currentCount = getPromptCount() + 1;
        incrementPromptCount();

        trackInstallPWAEvent({
          type: "prompt_shown",
          promptCount: currentCount,
        });
      }
    };

    const checkInstalled = () => {
      if (isPWAInstalled()) {
        setIsInstalled(true);
      }
    };

    const checkPWASupport = () => {
      const promptCount = getPromptCount();

      // Check for iOS devices that support PWA but don't have beforeinstallprompt
      if (
        isIOS() &&
        !isPWAInstalled() &&
        promptCount < MAX_PROMPT_COUNT &&
        canShowInstallPWA
      ) {
        setSupportsPWA(true);
        setShowIOSInstructions(true);
        setIsOpen(true);
        setInstallPWAVisible(true);
        incrementPromptCount();
        trackInstallPWAEvent({ type: "ios_instructions_shown" });
        return;
      }

      // Check for browsers that support beforeinstallprompt
      if (supportsBeforeInstallPrompt() && promptCount < MAX_PROMPT_COUNT) {
        window.addEventListener("beforeinstallprompt", handler);
      } else if (promptCount >= MAX_PROMPT_COUNT) {
        // PWA prompt showed too many times
      }
    };

    // Give InstallPWA immediate priority on page load
    const immediateCheck = () => {
      checkInstalled();
      checkPWASupport();
    };

    // Run immediately
    immediateCheck();

    // Also set up event listeners
    window.addEventListener("appinstalled", checkInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", checkInstalled);
    };
  }, [
    isClient,
    incrementPromptCount,
    getPromptCount,
    canShowInstallPWA,
    setInstallPWAVisible,
  ]);

  const installPWA = async (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();

    if (!promptInstall) {
      trackInstallPWAEvent({
        type: "install_error",
        error: "No install prompt available",
      });
      return;
    }

    try {
      trackInstallPWAEvent({ type: "install_clicked" });

      // Trigger the install prompt
      await promptInstall.prompt();

      // Wait for user choice
      const result = await promptInstall.userChoice;

      if (result.outcome === "accepted") {
        trackInstallPWAEvent({ type: "install_success" });
        // PWA install accepted
      } else {
        trackInstallPWAEvent({ type: "install_dismissed" });
        // PWA install dismissed
      }

      setIsOpen(false);
      setTimeout(() => {
        setHide(true);
      }, 700);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "PWA installation failed with an unknown error";
      trackInstallPWAEvent({
        type: "install_error",
        error: errorMessage,
      });
      // PWA install failed - error logged to analytics

      // Still hide the prompt even if install failed
      setIsOpen(false);
      setTimeout(() => {
        setHide(true);
      }, 700);
    }
  };

  const closePrompt = () => {
    trackInstallPWAEvent({ type: "prompt_closed_manually" });
    setIsOpen(false);
    setInstallPWAVisible(false);
    setTimeout(() => {
      setHide(true);
    }, 700);
  };

  // Check if the prompt should be shown based on the count
  useEffect(() => {
    if (!isClient) return;
    const currentCount = getPromptCount();
    if (currentCount >= MAX_PROMPT_COUNT) {
      setHide(true); // Hide the prompt if the count exceeds max
    }
  }, [isClient, getPromptCount]);

  // Don't render anything on server-side or if conditions aren't met
  if (!isClient || !supportsPWA || isInstalled || hide) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-200 bottom-0 right-0 sm:right-4 sm:bottom-4 w-full sm:max-w-md duration-700",
        !isOpen
          ? "transition-[opacity,transform] translate-y-8 opacity-0"
          : "transition-[opacity,transform] translate-y-0 opacity-100",
      )}
    >
      <div className="m-3 dark:bg-card bg-background border border-border rounded-lg shadow-lg relative">
        <button
          onClick={closePrompt}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="size-5" />
        </button>
        <div className="p-4">
          <h1 className="text-lg font-medium">Install the App</h1>
          {showIOSInstructions ? (
            <div className="text-sm text-left text-muted-foreground flex flex-col gap-3">
              <p>
                Install this app on your iOS device for a better experience
                (must be done in <span className="font-bold">Safari</span>):
              </p>
              <ol className="flex flex-col gap-2 list-decimal pl-4">
                <li>
                  <div className="flex items-center gap-2">
                    <span>Tap the</span>
                    <Share className="size-4" />
                    <span>Share button below</span>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col gap-2">
                    <span>Scroll down and tap</span>
                    <span className="flex items-center gap-2">
                      <span>&ldquo;Add to Home Screen&rdquo;</span>
                      <SquarePlus className="size-4" />
                    </span>
                  </div>
                </li>
                <li>Tap &ldquo;Add&rdquo; to install the app</li>
              </ol>
            </div>
          ) : (
            <p className="text-sm text-left text-muted-foreground">
              You can install this app on your device for a better experience.
              Click the button below to install.
            </p>
          )}
        </div>
        <div className="p-4 flex items-center justify-center gap-2 border-t">
          {showIOSInstructions ? (
            <Button onClick={closePrompt} variant="outline">
              Got it
            </Button>
          ) : (
            <Button onClick={installPWA}>Install</Button>
          )}
        </div>
      </div>
    </div>
  );
}
