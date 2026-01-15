"use client";

import { formatPercentage, isImprovement } from "@/lib/wrapped/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface ComparisonsSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function ComparisonsSlide({
  data,
  isActive = false,
}: ComparisonsSlideProps) {
  // Handle case where comparisons data might be null
  if (!data.comparisons) {
    return (
      <BaseSlide
        isActive={isActive}
        className="bg-gradient-to-br from-teal-50 to-cyan-50"
      >
        <SlideTitle>How You Compare</SlideTitle>
        <SlideSubtitle>vs Average & Last Year</SlideSubtitle>
        <div className="text-center text-gray-600">
          <p>No comparison data available for this festival</p>
        </div>
      </BaseSlide>
    );
  }

  const { vs_festival_avg, vs_last_year } = data.comparisons;
  const improvement = vs_last_year ? isImprovement(vs_last_year) : null;

  const getIcon = (diff: number) => {
    if (diff > 0) return <ArrowUp className="size-5 text-green-500" />;
    if (diff < 0) return <ArrowDown className="size-5 text-red-500" />;
    return <Minus className="size-5 text-gray-400" />;
  };

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-teal-50 to-cyan-50"
    >
      <SlideTitle>How You Compare</SlideTitle>
      <SlideSubtitle>vs Average & Last Year</SlideSubtitle>

      <div className="w-full max-w-2xl space-y-6">
        {/* vs Festival Average */}
        {vs_festival_avg && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
              vs Festival Average
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">Beers</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_festival_avg.beers_diff_pct || 0)}
                  <span className="font-bold text-gray-800">
                    {formatPercentage(vs_festival_avg.beers_diff_pct || 0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">Days</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_festival_avg.days_diff_pct || 0)}
                  <span className="font-bold text-gray-800">
                    {formatPercentage(vs_festival_avg.days_diff_pct || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* vs Last Year */}
        {vs_last_year && improvement && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
              vs Last Year (
              {vs_last_year.prev_festival_name || "Previous Festival"})
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">Beers</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_last_year.beers_diff || 0)}
                  <span className="font-bold text-gray-800">
                    {(vs_last_year.beers_diff || 0) > 0 ? "+" : ""}
                    {vs_last_year.beers_diff || 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-700">Days</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_last_year.days_diff || 0)}
                  <span className="font-bold text-gray-800">
                    {(vs_last_year.days_diff || 0) > 0 ? "+" : ""}
                    {vs_last_year.days_diff || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No data message */}
        {!vs_festival_avg && !vs_last_year && (
          <div className="rounded-xl bg-white p-6 text-center shadow-lg">
            <p className="text-gray-600">
              No comparison data available for this festival
            </p>
          </div>
        )}
      </div>
    </BaseSlide>
  );
}
