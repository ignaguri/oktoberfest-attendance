import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * PWA Detection Utilities
 */

/**
 * Checks if the app is currently running as a PWA (Progressive Web App)
 * @returns boolean indicating if the app is installed as a PWA
 */
export function isPWAInstalled(): boolean {
  if (typeof window !== "undefined") {
    // Check if running in standalone mode (PWA installed)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
    // Check for iOS Safari standalone mode
    if (
      "standalone" in window.navigator &&
      (window.navigator as any).standalone === true
    ) {
      return true;
    }
    // Check for Android app context
    if (document.referrer.includes("android-app://")) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the current device is iOS
 * @returns boolean indicating if the device is iOS
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Checks if the browser supports the beforeinstallprompt event
 * @returns boolean indicating if beforeinstallprompt is supported
 */
export function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "BeforeInstallPromptEvent" in window || "onbeforeinstallprompt" in window
  );
}

/**
 * Avatar URL Utilities
 */

/**
 * Gets the correct avatar URL, handling both full URLs (from OAuth providers) and filenames (uploaded images)
 * @param avatarUrl - The avatar URL from the database (could be full URL or filename)
 * @returns The correct URL to use for displaying the avatar
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
): string | undefined {
  if (!avatarUrl) return undefined;

  // If it's already a full URL (from Google, Facebook, etc.), return as-is
  if (avatarUrl.startsWith("http")) {
    return avatarUrl;
  }

  // If it's a filename, construct the API URL
  return `/api/image/${avatarUrl}`;
}
