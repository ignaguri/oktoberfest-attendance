"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
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
  | { type: "prompt_closed_manually" };

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
    }
  }
}

function isPWAInstalled(): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      console.debug("PWA already installed");
      return true;
    }
    if (
      "standalone" in window.navigator &&
      (window.navigator as any).standalone === true
    ) {
      console.debug("PWA already installed");
      return true;
    }
    if (document.referrer.includes("android-app://")) {
      console.debug("PWA already installed");
      return true;
    }
  }
  return false;
}

export default function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hide, setHide] = useState(false);

  const incrementPromptCount = useCallback(() => {
    if (hide || isInstalled) return;

    const currentCount = getPromptCount();
    if (currentCount < MAX_PROMPT_COUNT) {
      localStorage.setItem("pwaPromptCount", (currentCount + 1).toString());
    }
  }, [hide, isInstalled]);

  useEffect(() => {
    const handler = (e: Event) => {
      const installEvent = e as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setSupportsPWA(true);
      setIsOpen(true);
      setPromptInstall(installEvent);

      const currentCount = getPromptCount() + 1;
      incrementPromptCount();

      trackInstallPWAEvent({ type: "prompt_shown", promptCount: currentCount });
    };

    const checkInstalled = () => {
      if (isPWAInstalled()) {
        setIsInstalled(true);
      }
    };

    const promptCount = getPromptCount();
    if (promptCount < MAX_PROMPT_COUNT) {
      window.addEventListener("beforeinstallprompt", handler);
    }
    console.debug("PWA prompt showed too many times");

    checkInstalled();
    window.addEventListener("appinstalled", checkInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", checkInstalled);
    };
  }, [incrementPromptCount]);

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
        console.debug("PWA install accepted");
      } else {
        trackInstallPWAEvent({ type: "install_dismissed" });
        console.debug("PWA install dismissed");
      }

      setIsOpen(false);
      setTimeout(() => {
        setHide(true);
      }, 700);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "PWA installation failed with an unknown error";
      trackInstallPWAEvent({
        type: "install_error",
        error: errorMessage,
      });
      console.error("PWA install failed:", error);

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
    setTimeout(() => {
      setHide(true);
    }, 700);
  };

  const getPromptCount = () => {
    const count = localStorage.getItem("pwaPromptCount");
    return count ? parseInt(count, 10) : 0;
  };

  // Check if the prompt should be shown based on the count
  useEffect(() => {
    const currentCount = getPromptCount();
    if (currentCount >= MAX_PROMPT_COUNT) {
      setHide(true); // Hide the prompt if the count exceeds max
    }
  }, []);

  if (!supportsPWA || isInstalled || hide) {
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
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-4">
          <h1 className="text-lg font-medium">Install the App</h1>
          <p className="text-sm text-left text-muted-foreground">
            You can install this app on your device for a better experience.
            Click the button below to install.
          </p>
        </div>
        <div className="p-4 flex items-center justify-center gap-2 border-t">
          <Button onClick={installPWA}>Install</Button>
        </div>
      </div>
    </div>
  );
}
