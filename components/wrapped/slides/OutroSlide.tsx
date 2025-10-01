"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface OutroSlideProps {
  data: WrappedData;
  onShare?: () => void;
}

export function OutroSlide({ data, onShare }: OutroSlideProps) {
  return (
    <BaseSlide className="bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="flex flex-col items-center gap-6">
        <div className="text-7xl">🎉</div>

        <SlideTitle className="text-5xl">See You Next Year!</SlideTitle>

        <SlideSubtitle>Thanks for using ProstCounter</SlideSubtitle>

        <div className="mt-4 rounded-lg bg-white p-6 shadow-lg text-center max-w-md">
          <p className="text-lg font-semibold text-gray-800 mb-2">
            {data.basic_stats.total_beers} beers
          </p>
          <p className="text-gray-600">
            across {data.basic_stats.days_attended} unforgettable days at{" "}
            {data.festival_info.name}
          </p>
        </div>

        {onShare && (
          <Button
            onClick={onShare}
            size="lg"
            className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8"
          >
            <Share2 className="mr-2 h-5 w-5" />
            Share Your Wrapped
          </Button>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Made with 🍺 by ProstCounter</p>
        </div>
      </div>
    </BaseSlide>
  );
}
