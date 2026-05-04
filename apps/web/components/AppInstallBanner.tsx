"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { ChevronDown, Download, Smartphone, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { useInstallBanner, type Store } from "@/hooks/use-install-banner";
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function AppInstallBanner() {
  const { t } = useTranslation();
  const { setInstallBannerVisible, canShowInstallBanner } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleShow = useCallback(() => {
    setIsOpen(true);
    setInstallBannerVisible(true);
  }, [setInstallBannerVisible]);

  const handleHide = useCallback(() => {
    setIsOpen(false);
    setInstallBannerVisible(false);
  }, [setInstallBannerVisible]);

  const {
    variant,
    shouldShow,
    canAddToHomeScreen,
    triggerInstall,
    dismiss,
    trackStoreClick,
    iosInstructionsOpen,
    toggleIosInstructions,
    desktopQrOpen,
    toggleDesktopQr,
  } = useInstallBanner({
    enabled: canShowInstallBanner,
    onShow: handleShow,
    onClose: handleHide,
  });

  if (!variant || (!shouldShow && !isOpen)) return null;

  const handleClose = () => {
    dismiss();
    setIsOpen(false);
  };

  const isMobile = variant === "ios" || variant === "android";

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 z-200 w-full duration-700 sm:right-4 sm:bottom-4",
        isMobile ? "sm:max-w-md" : "sm:max-w-sm",
        !isOpen
          ? "translate-y-8 opacity-0 transition-[opacity,transform]"
          : "translate-y-0 opacity-100 transition-[opacity,transform]",
      )}
    >
      <div className="dark:bg-card bg-background border-border relative m-3 rounded-lg border shadow-lg">
        <button
          onClick={handleClose}
          aria-label={t("installBanner.common.close")}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="size-5" />
        </button>

        {variant === "ios" && (
          <IOSContent
            canAddToHomeScreen={canAddToHomeScreen}
            iosInstructionsOpen={iosInstructionsOpen}
            toggleIosInstructions={toggleIosInstructions}
            onStoreClick={() => trackStoreClick("ios")}
            onDismiss={handleClose}
          />
        )}
        {variant === "android" && (
          <AndroidContent
            onStoreClick={() => trackStoreClick("android")}
            onDismiss={handleClose}
          />
        )}
        {variant === "desktop-pwa" && (
          <DesktopPwaContent
            installPWA={triggerInstall}
            qrOpen={desktopQrOpen}
            toggleQr={toggleDesktopQr}
            onStoreClick={trackStoreClick}
            onDismiss={handleClose}
          />
        )}
        {variant === "desktop-qr" && (
          <DesktopQrContent onStoreClick={trackStoreClick} onDismiss={handleClose} />
        )}
      </div>
    </div>
  );
}

function BannerHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pr-6">
      <div className="text-primary">{icon}</div>
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  );
}

function IOSContent({
  canAddToHomeScreen,
  iosInstructionsOpen,
  toggleIosInstructions,
  onStoreClick,
  onDismiss,
}: {
  canAddToHomeScreen: boolean;
  iosInstructionsOpen: boolean;
  toggleIosInstructions: () => void;
  onStoreClick: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-2 p-4">
        <BannerHeader
          icon={<Smartphone className="size-5" />}
          title={t("installBanner.ios.title")}
        />
        <p className="text-muted-foreground text-sm">{t("installBanner.ios.message")}</p>
        <Button asChild className="w-full">
          <a
            href={IOS_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onStoreClick}
          >
            <Download className="mr-2 size-4" />
            {t("installBanner.ios.cta")}
          </a>
        </Button>
        {canAddToHomeScreen && (
          <>
            <button
              type="button"
              onClick={toggleIosInstructions}
              className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 text-xs"
            >
              {t("installBanner.ios.pwaToggle")}
              <ChevronDown
                className={cn("size-3 transition-transform", iosInstructionsOpen && "rotate-180")}
              />
            </button>
            {iosInstructionsOpen && (
              <p className="text-muted-foreground rounded-md bg-gray-50 p-2 text-xs dark:bg-gray-900">
                {t("installBanner.ios.pwaInstructions")}
              </p>
            )}
          </>
        )}
      </div>
      <BannerFooter onDismiss={onDismiss} />
    </>
  );
}

function AndroidContent({
  onStoreClick,
  onDismiss,
}: {
  onStoreClick: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-2 p-4">
        <BannerHeader
          icon={<Smartphone className="size-5" />}
          title={t("installBanner.android.title")}
        />
        <p className="text-muted-foreground text-sm">{t("installBanner.android.message")}</p>
        <Button asChild className="w-full">
          <a
            href={ANDROID_PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onStoreClick}
          >
            <Download className="mr-2 size-4" />
            {t("installBanner.android.cta")}
          </a>
        </Button>
      </div>
      <BannerFooter onDismiss={onDismiss} />
    </>
  );
}

function DesktopPwaContent({
  installPWA,
  qrOpen,
  toggleQr,
  onStoreClick,
  onDismiss,
}: {
  installPWA: () => void;
  qrOpen: boolean;
  toggleQr: () => void;
  onStoreClick: (store: Store) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-2 p-4">
        <BannerHeader
          icon={<Download className="size-5" />}
          title={t("installBanner.desktop.installTitle")}
        />
        <p className="text-muted-foreground text-sm">
          {t("installBanner.desktop.installMessage")}
        </p>
        <Button onClick={installPWA} className="w-full">
          {t("installBanner.desktop.installCta")}
        </Button>
        <button
          type="button"
          onClick={toggleQr}
          className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 text-xs"
        >
          {t("installBanner.desktop.phoneExpand")}
          <ChevronDown
            className={cn("size-3 transition-transform", qrOpen && "rotate-180")}
          />
        </button>
        {qrOpen && <PhoneSection onStoreClick={onStoreClick} />}
      </div>
      <BannerFooter onDismiss={onDismiss} />
    </>
  );
}

function DesktopQrContent({
  onStoreClick,
  onDismiss,
}: {
  onStoreClick: (store: Store) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-2 p-4">
        <BannerHeader
          icon={<Smartphone className="size-5" />}
          title={t("installBanner.desktop.phoneTitle")}
        />
        <p className="text-muted-foreground text-sm">
          {t("installBanner.desktop.phoneMessage")}
        </p>
        <PhoneSection onStoreClick={onStoreClick} />
      </div>
      <BannerFooter onDismiss={onDismiss} />
    </>
  );
}

function PhoneSection({ onStoreClick }: { onStoreClick: (store: Store) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <Image
        src="/images/qrcode-download.svg"
        alt={t("installBanner.desktop.qrAlt")}
        width={140}
        height={140}
        className="rounded-md border border-gray-200 bg-white p-2"
      />
      <div className="flex w-full flex-col gap-2">
        <a
          href={IOS_APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onStoreClick("ios")}
          className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800"
        >
          <Download className="mr-2 size-3.5" />
          App Store
        </a>
        <a
          href={ANDROID_PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onStoreClick("android")}
          className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800"
        >
          <Download className="mr-2 size-3.5" />
          Google Play
        </a>
      </div>
    </div>
  );
}

function BannerFooter({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end border-t p-3">
      <Button onClick={onDismiss} variant="ghost" size="sm">
        {t("installBanner.common.dismiss")}
      </Button>
    </div>
  );
}
