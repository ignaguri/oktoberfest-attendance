"use client";

import { useConfetti } from "@/hooks/useConfetti";
import { ANIMATION_DELAYS } from "@/lib/wrapped/config";
import { formatWrappedDate, formatCurrency } from "@/lib/wrapped/utils";
import { BicepsFlexed, Tent, Beer } from "lucide-react";
import { useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface PeakMomentSlideProps {
  data: WrappedData;
}

export function PeakMomentSlide({ data }: PeakMomentSlideProps) {
  const { isExploding, triggerConfetti } = useConfetti();
  const { best_day, max_single_session } = data.peak_moments;

  useEffect(() => {
    if (best_day) {
      const timer = setTimeout(
        triggerConfetti,
        ANIMATION_DELAYS.confettiTriggerPeak,
      );
      return () => clearTimeout(timer);
    }
  }, [triggerConfetti, best_day]);

  return (
    <BaseSlide className="bg-gradient-to-br from-amber-50 to-yellow-50">
      {isExploding && best_day && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConfettiExplosion
            force={0.6}
            duration={2500}
            particleCount={150}
            width={1200}
            zIndex={100}
          />
        </div>
      )}

      <SlideTitle>Peak moments</SlideTitle>
      <SlideSubtitle>Your best performances</SlideSubtitle>

      <div className="z-10 w-full max-w-2xl flex flex-col gap-4">
        {best_day && (
          <div className="rounded-xl bg-white p-6 shadow-lg flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-4">
              <Beer className="size-10" />
              <Tent className="size-10" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">Best day</h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">
                  {best_day.beer_count}
                </p>
                <p className="text-xs text-gray-500">beers</p>
              </div>
              <div className="text-2xl text-gray-400">+</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-700">
                  {best_day.tents_visited}
                </p>
                <p className="text-xs text-gray-500">tents</p>
              </div>
            </div>
            <p className="text-gray-600">{formatWrappedDate(best_day.date)}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(best_day.spent)} spent
            </p>
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-lg flex flex-col items-center gap-2">
          <BicepsFlexed className="size-10" />
          <h3 className="text-lg font-semibold text-gray-700">
            Biggest session
          </h3>
          <p className="text-4xl font-bold text-yellow-600">
            {max_single_session} beers
          </p>
          <p className="text-sm text-gray-500">most beers in a single day</p>
        </div>
      </div>
    </BaseSlide>
  );
}
