"use client";

import { Button } from "@/components/ui/button";
import { Beer, HeartHandshake, Heart, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface OutroSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function OutroSlide({ data, isActive = false }: OutroSlideProps) {
  const router = useRouter();

  const handleDownload = useCallback(() => {
    // Store wrapped data in localStorage for the share page
    localStorage.setItem("wrapped-share-data", JSON.stringify(data));

    // Navigate to dedicated share page
    router.push("/wrapped/share");
  }, [data, router]);

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
          className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8"
        >
          <Download className="mr-2 h-5 w-5" />
          Download & Share
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
    </BaseSlide>
  );
}
