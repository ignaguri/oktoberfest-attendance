"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const MAX_PROMPT_COUNT = 3;

function isPWAInstalled(): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (
      "standalone" in window.navigator &&
      (window.navigator as any).standalone === true
    )
      return true;
    if (document.referrer.includes("android-app://")) return true;
  }
  return false;
}

export default function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
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
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setIsOpen(true);
      setPromptInstall(e);
      incrementPromptCount();
    };
    window.addEventListener("beforeinstallprompt", handler);

    const checkInstalled = () => {
      if (isPWAInstalled()) {
        setIsInstalled(true);
      }
    };

    const promptCount = getPromptCount();
    if (promptCount < MAX_PROMPT_COUNT) {
      window.addEventListener("beforeinstallprompt", handler);
    }

    checkInstalled();
    window.addEventListener("appinstalled", checkInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", checkInstalled);
    };
  }, [incrementPromptCount]);

  const installPWA = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    if (promptInstall) {
      promptInstall.prompt();
      setIsOpen(false);
      setTimeout(() => {
        setHide(true);
      }, 700);
    }
  };

  const closePrompt = () => {
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
        "fixed z-[200] bottom-0 right-0 sm:right-4 sm:bottom-4 w-full sm:max-w-md duration-700",
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
