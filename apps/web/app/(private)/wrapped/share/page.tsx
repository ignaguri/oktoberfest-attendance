"use client";

import { Button } from "@/components/ui/button";
import { ShareImage } from "@/components/wrapped/ShareImage";
import { useTranslation } from "@/lib/i18n/client";
import { generateShareImageFromElement } from "@/lib/wrapped/preview-utils";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { WrappedData } from "@/lib/wrapped/types";

export default function ShareImagePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const shareImageRef = useRef<HTMLDivElement>(null);
  const [wrappedData, setWrappedData] = useState<WrappedData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAutoDownloaded, setHasAutoDownloaded] = useState(false);

  // Load wrapped data from localStorage
  useEffect(() => {
    const storedData = localStorage.getItem("wrapped-share-data");
    if (storedData) {
      try {
        const data = JSON.parse(storedData) as WrappedData;
        setWrappedData(data);
      } catch (error) {
        console.error("Failed to parse wrapped data:", error);
        toast.error(t("notifications.error.wrappedLoadFailed"));
        router.push("/wrapped");
      }
    } else {
      toast.error(t("notifications.error.wrappedNotFound"));
      router.push("/wrapped");
    }
  }, [router, t]);

  const handleDownload = async () => {
    if (!shareImageRef.current || !wrappedData) return;

    setIsGenerating(true);
    toast.loading("Generating your wrapped image...");

    try {
      // Preload fonts for better Safari compatibility
      await document.fonts.ready;

      // Wait for all images to load, especially important for Safari
      const images = shareImageRef.current?.querySelectorAll("img");
      if (images && images.length > 0) {
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = () => resolve(undefined);
              img.onerror = () => resolve(undefined);
              // Fallback timeout
              setTimeout(() => resolve(undefined), 2000);
            });
          }),
        );
      }

      // Additional wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 500));

      const blob = await generateShareImageFromElement(shareImageRef.current);

      if (!blob) {
        throw new Error("Failed to generate image");
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${wrappedData.festival_info.name}-wrapped.png`;
      link.click();

      // Cleanup
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success(t("notifications.success.imageDownloaded"));
    } catch (error) {
      console.error("Failed to generate image:", error);
      toast.dismiss();
      toast.error(t("notifications.error.imageGenerateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-trigger download once data is loaded and component is mounted
  useEffect(() => {
    if (wrappedData && shareImageRef.current && !hasAutoDownloaded) {
      // Wait a bit for everything to render
      const timer = setTimeout(() => {
        handleDownload();
        setHasAutoDownloaded(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [wrappedData, hasAutoDownloaded]);

  if (!wrappedData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Button
        onClick={handleDownload}
        disabled={isGenerating}
        size="lg"
        variant="yellow"
      >
        <Download className="mr-2 h-4 w-4" />
        {isGenerating ? "Generating..." : "Download Again"}
      </Button>

      {/* Centered ShareImage at proper scale */}
      <div className="flex items-center justify-center">
        <div
          className="shadow-2xl rounded-lg overflow-hidden"
          style={{
            width: "1080px",
            height: "1920px",
            transform: "scale(0.35)",
            transformOrigin: "top center",
          }}
        >
          <ShareImage ref={shareImageRef} data={wrappedData} />
        </div>
      </div>
    </div>
  );
}
