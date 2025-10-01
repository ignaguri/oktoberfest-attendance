"use client";

import { formatPercentage, isImprovement } from "@/lib/wrapped/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface ComparisonsSlideProps {
  data: WrappedData;
}

export function ComparisonsSlide({ data }: ComparisonsSlideProps) {
  const { vs_festival_avg, vs_last_year } = data.comparisons;
  const improvement = isImprovement(vs_last_year);

  const getIcon = (diff: number) => {
    if (diff > 0) return <ArrowUp className="h-5 w-5 text-green-500" />;
    if (diff < 0) return <ArrowDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-gray-400" />;
  };

  return (
    <BaseSlide className="bg-gradient-to-br from-teal-50 to-cyan-50">
      <SlideTitle>How You Compare</SlideTitle>
      <SlideSubtitle>vs Average & Last Year</SlideSubtitle>

      <div className="w-full max-w-2xl space-y-6">
        {/* vs Festival Average */}
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
            vs Festival Average
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Beers</span>
              <div className="flex items-center gap-2">
                {getIcon(vs_festival_avg.beers_diff_pct)}
                <span className="font-bold text-gray-800">
                  {formatPercentage(vs_festival_avg.beers_diff_pct)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Days</span>
              <div className="flex items-center gap-2">
                {getIcon(vs_festival_avg.days_diff_pct)}
                <span className="font-bold text-gray-800">
                  {formatPercentage(vs_festival_avg.days_diff_pct)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* vs Last Year */}
        {vs_last_year && improvement && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              vs Last Year
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Beers</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_last_year.beers_diff)}
                  <span className="font-bold text-gray-800">
                    {vs_last_year.beers_diff > 0 ? "+" : ""}
                    {vs_last_year.beers_diff}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Days</span>
                <div className="flex items-center gap-2">
                  {getIcon(vs_last_year.days_diff)}
                  <span className="font-bold text-gray-800">
                    {vs_last_year.days_diff > 0 ? "+" : ""}
                    {vs_last_year.days_diff}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseSlide>
  );
}
