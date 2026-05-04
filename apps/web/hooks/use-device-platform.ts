"use client";

import { useEffect, useState } from "react";

import { isAndroid, isIOS, isPWAInstalled, supportsBeforeInstallPrompt } from "@/lib/utils";

export type DeviceOS = "ios" | "android" | "desktop" | "unknown";
export type DeviceBrowser = "safari" | "other";

export interface DevicePlatform {
  os: DeviceOS;
  browser: DeviceBrowser;
  isStandalone: boolean;
  canPromptPWA: boolean;
}

const SSR_DEFAULT: DevicePlatform = {
  os: "unknown",
  browser: "other",
  isStandalone: false,
  canPromptPWA: false,
};

function detectBrowser(): DeviceBrowser {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // Safari = WebKit/Safari but not Chrome / Android (covers iOS Safari + macOS Safari)
  if (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) {
    return "safari";
  }
  return "other";
}

export function useDevicePlatform(): DevicePlatform {
  const [platform, setPlatform] = useState<DevicePlatform>(SSR_DEFAULT);

  useEffect(() => {
    const compute = (): DevicePlatform => {
      let os: DeviceOS = "desktop";
      if (isIOS()) os = "ios";
      else if (isAndroid()) os = "android";

      return {
        os,
        browser: detectBrowser(),
        isStandalone: isPWAInstalled(),
        canPromptPWA: supportsBeforeInstallPrompt(),
      };
    };

    setPlatform(compute());
  }, []);

  return platform;
}
