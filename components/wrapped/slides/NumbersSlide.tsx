"use client";

import { formatCurrency, formatNumber } from "@/lib/wrapped/utils";
import { useMemo } from "react";

import type { WrappedData } from "@/lib/wrapped/types";

import {
  BaseSlide,
  SlideTitle,
  SlideSubtitle,
  SlideContent,
  StatItem,
} from "./BaseSlide";

interface NumbersSlideProps {
  data: WrappedData;
}

export function NumbersSlide({ data }: NumbersSlideProps) {
  const { total_beers, days_attended, total_spent, avg_beers } =
    data.basic_stats;

  const finalMessage = useMemo(() => {
    if (total_beers > 10 || avg_beers > 2.1) {
      return "That's a lot of Prost! 🎉";
    }

    if (days_attended > 3) {
      return "That's a lot of days! 🎉";
    }

    return "That's not too bad! 🎉";
  }, [avg_beers, days_attended, total_beers]);

  return (
    <BaseSlide className="bg-gradient-to-br from-blue-50 to-cyan-50">
      <SlideTitle>Your festival in numbers</SlideTitle>
      <SlideSubtitle>Here&apos;s what you did</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon="🍺"
          label="Total beers"
          value={formatNumber(total_beers)}
        />

        <StatItem icon="📅" label="Days attended" value={days_attended} />

        <StatItem
          icon="📊"
          label="Average per day"
          value={formatNumber(avg_beers)}
        />

        <StatItem
          icon="💰"
          label="Total spent"
          value={formatCurrency(total_spent)}
        />
      </SlideContent>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>{finalMessage}</p>
      </div>
    </BaseSlide>
  );
}
