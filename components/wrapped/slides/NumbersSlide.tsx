"use client";

import { formatCurrency, formatNumber } from "@/lib/wrapped/utils";

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

  return (
    <BaseSlide className="bg-gradient-to-br from-blue-50 to-cyan-50">
      <SlideTitle>Your Festival in Numbers</SlideTitle>
      <SlideSubtitle>Here&apos;s what you accomplished</SlideSubtitle>

      <SlideContent className="space-y-4">
        <StatItem
          icon="🍺"
          label="Total Beers"
          value={formatNumber(total_beers)}
        />

        <StatItem icon="📅" label="Days Attended" value={days_attended} />

        <StatItem
          icon="📊"
          label="Average per Day"
          value={avg_beers.toFixed(1)}
        />

        <StatItem
          icon="💰"
          label="Total Spent"
          value={formatCurrency(total_spent)}
        />
      </SlideContent>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>That&apos;s a lot of Prost! 🎉</p>
      </div>
    </BaseSlide>
  );
}
