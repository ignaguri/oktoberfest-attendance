"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useDevicePlatform } from "@/hooks/use-device-platform";
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "@/lib/constants";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type BannerVariant = "ios" | "android" | "desktop-pwa" | "desktop-qr";
export type Store = "ios" | "android";

const DISMISSAL_KEY = "installBannerDismissedAt";
const LEGACY_COUNT_KEY = "pwaPromptCount";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const FAR_FUTURE_ISO = "2999-01-01T00:00:00.000Z";

type AnalyticsEvent =
  | { type: "banner_shown"; variant: BannerVariant }
  | { type: "store_clicked"; variant: BannerVariant; store: Store }
  | { type: "banner_dismissed"; variant: BannerVariant }
  | { type: "pwa_prompt_shown" }
  | { type: "pwa_install_clicked" }
  | { type: "pwa_install_success" }
  | { type: "pwa_install_dismissed" }
  | { type: "pwa_ios_instructions_shown" };

function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || !("gtag" in window)) return;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;

  switch (event.type) {
    case "banner_shown":
      gtag("event", "install_banner_shown", {
        event_category: "Install",
        event_label: event.variant,
      });
      break;
    case "store_clicked":
      gtag("event", "install_banner_store_clicked", {
        event_category: "Install",
        event_label: event.store,
        custom_parameters: { variant: event.variant },
      });
      break;
    case "banner_dismissed":
      gtag("event", "install_banner_dismissed", {
        event_category: "Install",
        event_label: event.variant,
      });
      break;
    case "pwa_prompt_shown":
      gtag("event", "pwa_prompt_shown", { event_category: "PWA" });
      break;
    case "pwa_install_clicked":
      gtag("event", "pwa_install_clicked", { event_category: "PWA" });
      break;
    case "pwa_install_success":
      gtag("event", "pwa_install_success", { event_category: "PWA", value: 1 });
      break;
    case "pwa_install_dismissed":
      gtag("event", "pwa_install_dismissed", { event_category: "PWA" });
      break;
    case "pwa_ios_instructions_shown":
      gtag("event", "pwa_ios_instructions_shown", { event_category: "PWA" });
      break;
  }
}

function readDismissedAt(): Date | null {
  if (typeof window === "undefined") return null;
  const legacy = localStorage.getItem(LEGACY_COUNT_KEY);
  if (legacy !== null) {
    const now = new Date().toISOString();
    localStorage.setItem(DISMISSAL_KEY, now);
    localStorage.removeItem(LEGACY_COUNT_KEY);
    return new Date(now);
  }
  const value = localStorage.getItem(DISMISSAL_KEY);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function persistDismissal(permanent = false): void {
  if (typeof window === "undefined") return;
  const value = permanent ? FAR_FUTURE_ISO : new Date().toISOString();
  localStorage.setItem(DISMISSAL_KEY, value);
}

function inCooldown(dismissedAt: Date | null): boolean {
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt.getTime() < COOLDOWN_MS;
}

interface UseInstallBannerOptions {
  enabled?: boolean;
  onShow?: () => void;
  onClose?: () => void;
}

export interface UseInstallBannerResult {
  variant: BannerVariant | null;
  shouldShow: boolean;
  canInstall: boolean;
  /** True when the device supports Add-to-Home-Screen (iOS Safari only). */
  canAddToHomeScreen: boolean;
  triggerInstall: () => void;
  dismiss: (opts?: { permanent?: boolean }) => void;
  trackStoreClick: (store: Store) => void;
  iosInstructionsOpen: boolean;
  toggleIosInstructions: () => void;
  desktopQrOpen: boolean;
  toggleDesktopQr: () => void;
}

export function useInstallBanner(options: UseInstallBannerOptions = {}): UseInstallBannerResult {
  const { enabled = true, onShow, onClose } = options;
  const { t } = useTranslation();
  const platform = useDevicePlatform();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const [desktopQrOpen, setDesktopQrOpen] = useState(false);
  const shownRef = useRef(false);

  const variant = useMemo<BannerVariant | null>(() => {
    if (platform.os === "unknown") return null;
    if (platform.isStandalone) return null;
    if (platform.os === "ios") return "ios";
    if (platform.os === "android") return "android";
    if (platform.os === "desktop") {
      // Only offer the PWA install path once we have actually captured
      // beforeinstallprompt — capability detection alone isn't enough,
      // since Chromium exposes the API on pages that aren't installable.
      return deferredPrompt !== null ? "desktop-pwa" : "desktop-qr";
    }
    return null;
  }, [platform, deferredPrompt]);

  // Side-effects (event listeners, auto-show timer) only run when the consumer
  // wants the banner. `enabled: false` lets UserMenu read variant/canInstall
  // without double-registering global listeners that AppInstallBanner owns.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      persistDismissal(true);
      setShouldShow(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!variant) return;
    if (shownRef.current) return;
    if (inCooldown(readDismissedAt())) return;

    shownRef.current = true;
    setShouldShow(true);
    track({ type: "banner_shown", variant });
    if (variant === "ios") track({ type: "pwa_ios_instructions_shown" });
    if (variant === "desktop-pwa") track({ type: "pwa_prompt_shown" });
    onShow?.();
  }, [enabled, variant, onShow]);

  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      toast.error(t("installBanner.toast.unavailable"));
      return;
    }
    track({ type: "pwa_install_clicked" });
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        track({ type: "pwa_install_success" });
        toast.success(t("installBanner.toast.success"));
        persistDismissal(true);
        setShouldShow(false);
        onClose?.();
      } else {
        track({ type: "pwa_install_dismissed" });
      }
      setDeferredPrompt(null);
    } catch {
      toast.error(t("installBanner.toast.failed"));
    }
  }, [deferredPrompt, onClose, t]);

  const dismiss = useCallback(
    (opts?: { permanent?: boolean }) => {
      if (variant) track({ type: "banner_dismissed", variant });
      persistDismissal(opts?.permanent ?? false);
      setShouldShow(false);
      onClose?.();
    },
    [variant, onClose],
  );

  const trackStoreClick = useCallback(
    (store: Store) => {
      if (!variant) return;
      track({ type: "store_clicked", variant, store });
      // Treat a store click as strong intent — silence the banner permanently
      // since we can't observe install completion across the store redirect.
      persistDismissal(true);
      setShouldShow(false);
      onClose?.();
    },
    [variant, onClose],
  );

  const toggleIosInstructions = useCallback(() => setIosInstructionsOpen((v) => !v), []);
  const toggleDesktopQr = useCallback(() => setDesktopQrOpen((v) => !v), []);

  const canInstall = variant !== null && variant !== "desktop-qr";
  const canAddToHomeScreen = platform.os === "ios" && platform.browser === "safari";
  const triggerInstall = useCallback(() => {
    if (!variant) return;
    if (variant === "desktop-pwa") {
      void installPWA();
      return;
    }
    if (variant === "ios") {
      trackStoreClick("ios");
      window.open(IOS_APP_STORE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    if (variant === "android") {
      trackStoreClick("android");
      window.open(ANDROID_PLAY_STORE_URL, "_blank", "noopener,noreferrer");
    }
  }, [variant, installPWA, trackStoreClick]);

  return {
    variant,
    shouldShow,
    canInstall,
    canAddToHomeScreen,
    triggerInstall,
    dismiss,
    trackStoreClick,
    iosInstructionsOpen,
    toggleIosInstructions,
    desktopQrOpen,
    toggleDesktopQr,
  };
}
