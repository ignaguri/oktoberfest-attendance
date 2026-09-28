"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { formatCurrency, formatWrappedDate } from "@prostcounter/shared/wrapped";
import { Beer, BicepsFlexed, Tent } from "lucide-react";
import { useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";

import { useConfetti } from "@/hooks/useConfetti";
import { ANIMATION_DELAYS } from "@/lib/wrapped/config";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./BaseSlide";

interface PeakMomentSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function PeakMomentSlide({ data, isActive = false }: PeakMomentSlideProps) {
  const { t } = useTranslation();
  const { isExploding, triggerConfetti } = useConfetti();
  const { bestDay, maxSingleSession } = data.peakMoments;

  useEffect(() => {
    if (isActive && bestDay) {
      const timer = setTimeout(triggerConfetti, ANIMATION_DELAYS.confettiTriggerPeak);
      return () => clearTimeout(timer);
    }
  }, [isActive, triggerConfetti, bestDay]);

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-amber-50 to-yellow-50">
      {isExploding && bestDay && (
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

      <SlideTitle>{t("wrapped.peakMoment.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.peakMoment.subtitle")}</SlideSubtitle>

      <div className="z-10 flex w-full max-w-2xl flex-col gap-4">
        {bestDay && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-center gap-4">
              <Beer className="size-10" />
              <Tent className="size-10" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">
              {t("wrapped.peakMoment.bestDay")}
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{bestDay.beerCount}</p>
                <p className="text-xs text-gray-500">
                  {t("wrapped.peakMoment.beers", {
                    count: bestDay.beerCount,
                  })}
                </p>
              </div>
              <div className="text-2xl text-gray-400">+</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-700">{bestDay.tentsVisited}</p>
                <p className="text-xs text-gray-500">
                  {t("wrapped.peakMoment.tents", {
                    count: bestDay.tentsVisited,
                  })}
                </p>
              </div>
            </div>
            <p className="text-gray-600">{formatWrappedDate(bestDay.date)}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(bestDay.spent)} {t("wrapped.peakMoment.spent")}
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-6 shadow-lg">
          <BicepsFlexed className="size-10" />
          <h3 className="text-lg font-semibold text-gray-700">
            {t("wrapped.peakMoment.maxSession")}
          </h3>
          <p className="text-4xl font-bold text-yellow-600">
            {t("wrapped.peakMoment.beers", { count: maxSingleSession })}
          </p>
          <p className="text-sm text-gray-500">{t("wrapped.peakMoment.maxSessionDesc")}</p>
        </div>
      </div>
    </BaseSlide>
  );
}
