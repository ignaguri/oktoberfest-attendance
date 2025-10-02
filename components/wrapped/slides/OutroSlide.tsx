"use client";

import { Button } from "@/components/ui/button";
import { generateShareText } from "@/lib/wrapped/utils";
import { Share2, Beer, HeartHandshake, Heart } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface OutroSlideProps {
  data: WrappedData;
}

export function OutroSlide({ data }: OutroSlideProps) {
  const handleShare = useCallback(async () => {
    const shareText = generateShareText(data);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${data.festival_info.name} Wrapped`,
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
  }, [data]);

  return (
    <BaseSlide className="bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="flex flex-col items-center gap-4">
        <HeartHandshake className="size-16" />

        <SlideTitle className="text-5xl">See you next festival!</SlideTitle>

        <SlideSubtitle>Thanks for using ProstCounter</SlideSubtitle>

        <div className="mt-4 rounded-lg bg-white p-6 shadow-lg text-center max-w-md">
          <p className="text-lg font-semibold text-gray-800 mb-2">
            {data.basic_stats.total_beers} beers &{" "}
            {data.tent_stats.unique_tents} tents
          </p>
          <p className="text-gray-600">
            across {data.basic_stats.days_attended} unforgettable days at{" "}
            {data.festival_info.name}
          </p>
        </div>

        <Button
          onClick={handleShare}
          size="lg"
          className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8"
        >
          <Share2 className="mr-2 h-5 w-5" />
          Share Your Wrapped
        </Button>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p className="flex items-center gap-1">
            Made with <Heart className="size-4" /> and some{" "}
            <Beer className="size-4" /> by ProstCounter
          </p>
        </div>
      </div>
    </BaseSlide>
  );
}
