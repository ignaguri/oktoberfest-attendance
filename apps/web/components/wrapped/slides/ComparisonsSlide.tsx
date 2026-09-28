"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { formatPercentage, formatPercentile, isImprovement } from "@prostcounter/shared/wrapped";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { BaseSlide, SlideTitle } from "./BaseSlide";

interface ComparisonsSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function ComparisonsSlide({ data, isActive = false }: ComparisonsSlideProps) {
  const { t } = useTranslation();

  // Handle case where comparisons data might be null
  if (!data.comparisons) {
    return (
      <BaseSlide isActive={isActive} className="bg-gradient-to-br from-teal-50 to-cyan-50">
        <SlideTitle>{t("wrapped.comparisons.title")}</SlideTitle>
        <div className="text-center text-gray-600">
          <p>No comparison data available for this festival</p>
        </div>
      </BaseSlide>
    );
  }

  const { vsFestivalAvg, vsLastYear } = data.comparisons;
  const improvement = vsLastYear ? isImprovement(vsLastYear) : null;

  // Percentile rank is the better statistic, but cache rows written before it was added
  // only carry the mean-based diff, so fall back to that until they are regenerated.
  const hasPercentile =
    vsFestivalAvg?.beersPercentile !== undefined &&
    vsFestivalAvg?.daysPercentile !== undefined;

  const getIcon = (diff: number) => {
    if (diff > 0) return <ArrowUp className="size-5 text-green-500" />;
    if (diff < 0) return <ArrowDown className="size-5 text-red-500" />;
    return <Minus className="size-5 text-gray-400" />;
  };

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-teal-50 to-cyan-50">
      <SlideTitle>{t("wrapped.comparisons.title")}</SlideTitle>

      <div className="w-full max-w-2xl space-y-6">
        {/* vs Festival Average */}
        {vsFestivalAvg && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
              {t(
                hasPercentile
                  ? "wrapped.comparisons.vsAttendees"
                  : "wrapped.comparisons.vsFestivalAvg",
              )}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">{t("wrapped.comparisons.beers")}</span>
                {hasPercentile ? (
                  <div className="text-right">
                    <span className="font-bold text-gray-800">
                      {t("wrapped.comparisons.betterThan", {
                        percent: formatPercentile(vsFestivalAvg.beersPercentile ?? 0),
                      })}
                    </span>
                    {vsFestivalAvg.medianBeers !== undefined && (
                      <p className="text-xs text-gray-500">
                        {t("wrapped.comparisons.typical", { value: vsFestivalAvg.medianBeers })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {getIcon(vsFestivalAvg.beersDiffPct || 0)}
                    <span className="font-bold text-gray-800">
                      {formatPercentage(vsFestivalAvg.beersDiffPct || 0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">{t("wrapped.comparisons.days")}</span>
                {hasPercentile ? (
                  <div className="text-right">
                    <span className="font-bold text-gray-800">
                      {t("wrapped.comparisons.betterThan", {
                        percent: formatPercentile(vsFestivalAvg.daysPercentile ?? 0),
                      })}
                    </span>
                    {vsFestivalAvg.medianDays !== undefined && (
                      <p className="text-xs text-gray-500">
                        {t("wrapped.comparisons.typical", { value: vsFestivalAvg.medianDays })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {getIcon(vsFestivalAvg.daysDiffPct || 0)}
                    <span className="font-bold text-gray-800">
                      {formatPercentage(vsFestivalAvg.daysDiffPct || 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* vs Last Year */}
        {vsLastYear && improvement && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
              {t("wrapped.comparisons.vsLastYear")} (
              {vsLastYear.prevFestivalName || "Previous Festival"})
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">{t("wrapped.comparisons.beers")}</span>
                <div className="flex items-center gap-2">
                  {getIcon(vsLastYear.beersDiff || 0)}
                  <span className="font-bold text-gray-800">
                    {(vsLastYear.beersDiff || 0) > 0 ? "+" : ""}
                    {vsLastYear.beersDiff || 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">{t("wrapped.comparisons.days")}</span>
                <div className="flex items-center gap-2">
                  {getIcon(vsLastYear.daysDiff || 0)}
                  <span className="font-bold text-gray-800">
                    {(vsLastYear.daysDiff || 0) > 0 ? "+" : ""}
                    {vsLastYear.daysDiff || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No data message */}
        {!vsFestivalAvg && !vsLastYear && (
          <div className="rounded-xl bg-white p-6 text-center shadow-lg">
            <p className="text-gray-600">No comparison data available for this festival</p>
          </div>
        )}
      </div>
    </BaseSlide>
  );
}
