"use client";

import { Button } from "@/components/ui/button";
import { ShareImage } from "@/components/wrapped/ShareImage";
import { generateShareImageFromElement } from "@/lib/wrapped/preview-utils";
import { Beer, HeartHandshake, Heart, Download } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface OutroSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function OutroSlide({ data, isActive = false }: OutroSlideProps) {
  const shareImageRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!shareImageRef.current) return;

    setIsGenerating(true);
    toast.loading("Generating your wrapped image...");

    try {
      const blob = await generateShareImageFromElement(shareImageRef.current);

      if (!blob) {
        throw new Error("Failed to generate image");
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.festival_info.name}-wrapped.png`;
      link.click();

      // Cleanup
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Image downloaded successfully!");
    } catch (error) {
      console.error("Failed to generate image:", error);
      toast.dismiss();
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [data.festival_info.name]);

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-yellow-50 to-orange-50"
    >
      <div className="flex flex-col items-center gap-4">
        <HeartHandshake className="size-16" />

        <SlideTitle className="text-5xl">See you next festival!</SlideTitle>

        <SlideSubtitle>Thanks for using ProstCounter</SlideSubtitle>

        <div className="rounded-lg bg-white p-6 shadow-lg text-center max-w-md">
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
          onClick={handleDownload}
          size="lg"
          disabled={isGenerating}
          className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8"
        >
          <Download className="mr-2 h-5 w-5" />
          {isGenerating ? "Generating..." : "Download & Share"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Click to generate a shareable summary of your festival experience
        </p>

        <div className="mt-2 text-center text-sm text-gray-500">
          <p className="flex items-center gap-1">
            Made with <Heart className="size-4" /> and some{" "}
            <Beer className="size-4" /> by ProstCounter
          </p>
        </div>
      </div>

      {/* Hidden ShareImage for generation */}
      <div className="absolute -left-[9999px] top-0">
        <ShareImage ref={shareImageRef} data={data} />
      </div>
    </BaseSlide>
  );
}
