"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { cn } from "@/lib/utils";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";

export default function InstallPWA() {
  const { t } = useTranslation();
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
        "fixed right-0 bottom-0 z-200 w-full duration-700 sm:right-4 sm:bottom-4 sm:max-w-md",
        !isOpen
          ? "translate-y-8 opacity-0 transition-[opacity,transform]"
          : "translate-y-0 opacity-100 transition-[opacity,transform]",
      )}
    >
      <div className="dark:bg-card bg-background border-border relative m-3 rounded-lg border shadow-lg">
        <button
          onClick={closePrompt}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="size-5" />
        </button>
        <div className="p-4">
          <h1 className="text-lg font-medium">{t("pwa.install.title")}</h1>
          {showIOSInstructions ? (
            <div className="flex flex-col gap-3 text-left text-sm">
              <p className="text-muted-foreground">
                {t("pwa.install.appStore.message")}
              </p>
              <Button asChild className="w-full">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("pwa.install.appStore.button")}
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-left text-sm">
              {t("pwa.install.message")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 border-t p-4">
          {showIOSInstructions ? (
            <Button onClick={closePrompt} variant="outline">
              {t("common.buttons.gotIt")}
            </Button>
          ) : (
            <Button onClick={installPWA}>{t("pwa.install.button")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
