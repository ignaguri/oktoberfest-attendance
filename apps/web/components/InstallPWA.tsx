"use client";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { cn } from "@/lib/utils";
import { X, Share, SquarePlus } from "lucide-react";
import { useState } from "react";

export default function InstallPWA() {
  const { setInstallPWAVisible, canShowInstallPWA } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const {
    canInstall,
    installPWA: handleInstall,
    showIOSInstructions,
    shouldShow,
    closePrompt: handleClose,
    isInstalled,
  } = useInstallPWA({
    enableAutoShow: canShowInstallPWA,
    onPromptShow: () => {
      setIsOpen(true);
      setInstallPWAVisible(true);
    },
    onPromptClose: () => {
      setIsOpen(false);
      setInstallPWAVisible(false);
    },
  });

  const installPWA = async (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    await handleInstall();
    // Close after install attempt
    setTimeout(() => {
      setIsOpen(false);
      handleClose();
    }, 700);
  };

  const closePrompt = () => {
    handleClose();
    setIsOpen(false);
  };

  // Don't render anything if conditions aren't met
  if (!canInstall || isInstalled || (!shouldShow && !isOpen)) {
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
