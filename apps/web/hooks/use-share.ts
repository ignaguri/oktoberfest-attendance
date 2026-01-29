import { useTranslation } from "@prostcounter/shared/i18n";
import { useState } from "react";
import { toast } from "sonner";

export interface UseShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export function useShare(options: UseShareOptions = {}) {
  const { t } = useTranslation();
  const [copyButtonText, setCopyButtonText] = useState(
    t("groups.share.copyLink", { defaultValue: "Copy share text" }),
  );
  const [showQRCode, setShowQRCode] = useState(false);

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const defaultText = t("home.shareApp", {
    defaultValue:
      "Check out the ProstCounter app! Track your Oktoberfest attendance and compete with friends. Click here to join:",
  });

  // Only append URL if the text doesn't already contain a URL
  const textContainsUrl =
    options.text &&
    (options.text.includes("http") || options.text.includes("www."));
  const shareText = textContainsUrl
    ? options.text || defaultText
    : `${options.text || defaultText} ${options.url || APP_URL}`;

  // Check if Web Share API is supported
  const isWebShareSupported =
    typeof navigator !== "undefined" && "share" in navigator;

  const shareViaNative = async () => {
    if (!isWebShareSupported) {
      // Fallback to clipboard copy
      await copyToClipboard();
      return;
    }

    try {
      await navigator.share({
        title: options.title || "ProstCounter App",
        text: textContainsUrl ? options.text : options.text || defaultText,
        url: textContainsUrl ? undefined : options.url || APP_URL,
      });
    } catch (error) {
      // User cancelled or error occurred, fallback to clipboard
      if ((error as Error).name !== "AbortError") {
        toast.error(
          t("notifications.error.shareFailed", {
            defaultValue: "Share failed",
          }),
          {
            description: t("notifications.error.copyFailed", {
              defaultValue:
                "Native sharing failed. Copied to clipboard instead.",
            }),
          },
        );
      }
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyButtonText(
        t("groups.share.linkCopied", { defaultValue: "Copied!" }),
      );
      setTimeout(() => {
        setCopyButtonText(
          t("groups.share.copyLink", { defaultValue: "Copy share text" }),
        );
      }, 3000);
    } catch {
      toast.error(t("common.errors.title", { defaultValue: "Error" }), {
        description: t("notifications.error.copyFailed", {
          defaultValue: "Failed to copy text to clipboard.",
        }),
      });
    }
  };

  const shareViaWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
    );
  };

  const toggleQRCode = () => {
    setShowQRCode(!showQRCode);
  };

  const resetCopyButton = () => {
    setCopyButtonText(
      t("groups.share.copyLink", { defaultValue: "Copy share text" }),
    );
  };

  return {
    shareText,
    copyButtonText,
    showQRCode,
    isWebShareSupported,
    copyToClipboard,
    shareViaWhatsApp,
    shareViaNative,
    toggleQRCode,
    resetCopyButton,
  };
}
