"use client";

import { Button } from "@/components/ui/button";
import {
  WrappedContainer,
  WrappedLoading,
  WrappedError,
} from "@/components/wrapped/core/WrappedContainer";
import { useWrapped, useWrappedAccess } from "@/hooks/useWrapped";
import { generateShareText } from "@/lib/wrapped/utils";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { Link } from "next-view-transitions";
import { useCallback } from "react";
import { toast } from "sonner";

export default function WrappedPage() {
  const { festivalId } = useParams<{ festivalId: string }>();

  const {
    data: wrappedData,
    loading: dataLoading,
    error: dataError,
  } = useWrapped(festivalId);

  const { data: accessResult, loading: accessLoading } =
    useWrappedAccess(festivalId);

  const handleShare = useCallback(async () => {
    if (!wrappedData) return;

    const shareText = generateShareText(wrappedData);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${wrappedData.festival_info.name} Wrapped`,
          text: shareText,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.debug("Share failed:", error);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Copied to clipboard!");
      } catch (error) {
        console.debug("Failed to copy:", error);
        toast.error("Failed to copy to clipboard");
      }
    }
  }, [wrappedData]);

  // Loading state
  if (dataLoading || accessLoading) {
    return <WrappedLoading />;
  }

  // Access denied
  if (accessResult && !accessResult.allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Wrapped Not Available
          </h2>
          <p className="text-gray-600 mb-6">{accessResult.message}</p>
          <Button asChild>
            <Link href="/home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (dataError || !wrappedData) {
    return (
      <WrappedError
        message={dataError?.message || "Failed to load your wrapped"}
      />
    );
  }

  // Success - show wrapped
  return (
    <div className="relative">
      {/* Back button */}
      <Link
        href="/home"
        className="absolute top-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-black/50 px-4 py-2 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </Link>

      <WrappedContainer data={wrappedData} onShare={handleShare} />
    </div>
  );
}
