import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface UseShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export function useShare(options: UseShareOptions = {}) {
  const [copyButtonText, setCopyButtonText] = useState("Copy share text");
  const [showQRCode, setShowQRCode] = useState(false);
  const { toast } = useToast();

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const defaultText =
    "Check out the ProstCounter app! Track your Oktoberfest attendance and compete with friends. Click here to join:";
  const shareText = `${options.text || defaultText} ${options.url || APP_URL}`;

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
        text: options.text || defaultText,
        url: options.url || APP_URL,
      });
    } catch (error) {
      // User cancelled or error occurred, fallback to clipboard
      if ((error as Error).name !== "AbortError") {
        toast({
          variant: "destructive",
          title: "Share failed",
          description: "Native sharing failed. Copied to clipboard instead.",
        });
      }
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyButtonText("Copied!");
      setTimeout(() => {
        setCopyButtonText("Copy share text");
      }, 3000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy text to clipboard.",
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
    setCopyButtonText("Copy share text");
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
