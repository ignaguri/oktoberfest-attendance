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
    copyToClipboard,
    shareViaWhatsApp,
    toggleQRCode,
    resetCopyButton,
  };
}
