"use client";

import { useConfetti } from "@/hooks/useConfetti";
import { ANIMATION_DELAYS } from "@/lib/wrapped/config";
import { formatWrappedDate, formatCurrency } from "@/lib/wrapped/utils";
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
    const timer = setTimeout(
      triggerConfetti,
      ANIMATION_DELAYS.confettiTriggerPeak,
    );
    return () => clearTimeout(timer);
  }, [triggerConfetti]);

  return (
    <BaseSlide className="bg-gradient-to-br from-amber-50 to-yellow-50">
      {isExploding && best_day && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConfettiExplosion
            force={0.6}
            duration={2500}
            particleCount={100}
            width={1200}
          />
        </div>
      )}

      <SlideTitle>Peak Moments</SlideTitle>
      <SlideSubtitle>Your best performances</SlideSubtitle>

      <div className="z-10 w-full max-w-2xl space-y-6">
        {best_day && (
          <div className="rounded-xl bg-white p-6 shadow-lg text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Best Day
            </h3>
            <p className="text-4xl font-bold text-yellow-600 mb-2">
              {best_day.beer_count} beers
            </p>
            <p className="text-gray-600">{formatWrappedDate(best_day.date)}</p>
            <p className="text-sm text-gray-500 mt-2">
              {formatCurrency(best_day.spent)} spent
            </p>
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-lg text-center">
          <div className="text-5xl mb-3">⚡</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Biggest Session
          </h3>
          <p className="text-4xl font-bold text-yellow-600">
            {max_single_session} beers
          </p>
          <p className="text-sm text-gray-500 mt-2">in a single day</p>
        </div>
      </div>
    </BaseSlide>
  );
}
