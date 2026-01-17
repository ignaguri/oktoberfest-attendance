"use client";

import {
  Beer,
  CalendarDays,
  DollarSign,
  PartyPopper,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

import type { WrappedData } from "@/lib/wrapped/types";
import { formatCurrency, formatNumber } from "@/lib/wrapped/utils";

import {
  BaseSlide,
  SlideContent,
  SlideSubtitle,
  SlideTitle,
  StatItem,
} from "./BaseSlide";

interface NumbersSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function NumbersSlide({ data, isActive = false }: NumbersSlideProps) {
  const { total_beers, days_attended, total_spent, avg_beers } =
    data.basic_stats;

  const finalMessage = useMemo(() => {
    if (total_beers > 10 || avg_beers > 2.1) {
      return (
        <span className="flex items-center gap-1">
          That&apos;s a lot of Prost! <PartyPopper className="size-4" />
        </span>
      );
    }

    if (days_attended > 3) {
      return (
        <span className="flex items-center gap-1">
          That&apos;s a lot of days! <PartyPopper className="size-4" />
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1">
        That&apos;s not too bad! <PartyPopper className="size-4" />
      </span>
    );
  }, [avg_beers, days_attended, total_beers]);

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-blue-50 to-cyan-50"
    >
      <SlideTitle>Your festival in numbers</SlideTitle>
      <SlideSubtitle>Here&apos;s what you did</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon={<Beer className="size-5" />}
          label="Total beers"
          value={formatNumber(total_beers)}
        />

        <StatItem
          icon={<CalendarDays className="size-5" />}
          label="Days attended"
          value={days_attended}
        />

        <StatItem
          icon={<TrendingUp className="size-5" />}
          label="Average per day"
          value={formatNumber(avg_beers)}
        />

        <StatItem
          icon={<DollarSign className="size-5" />}
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
