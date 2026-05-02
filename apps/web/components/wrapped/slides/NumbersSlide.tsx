"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { formatCurrency, formatNumber } from "@prostcounter/shared/wrapped";
import { Beer, CalendarDays, DollarSign, PartyPopper, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { BaseSlide, SlideContent, SlideSubtitle, SlideTitle, StatItem } from "./BaseSlide";

interface NumbersSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function NumbersSlide({ data, isActive = false }: NumbersSlideProps) {
  const { t } = useTranslation();
  const { total_beers, days_attended, total_spent, avg_beers } = data.basic_stats;

  const finalMessageKey = useMemo(() => {
    if (total_beers > 10 || avg_beers > 2.1) {
      return "wrapped.numbers.finalMessageLotsOfProst";
    }
    if (days_attended > 3) {
      return "wrapped.numbers.finalMessageLotsOfDays";
    }
    return "wrapped.numbers.finalMessageNotBad";
  }, [avg_beers, days_attended, total_beers]);

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-blue-50 to-cyan-50">
      <SlideTitle>{t("wrapped.numbers.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.numbers.subtitle")}</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon={<Beer className="size-5" />}
          label={t("wrapped.numbers.totalBeers")}
          value={formatNumber(total_beers)}
        />

        <StatItem
          icon={<CalendarDays className="size-5" />}
          label={t("wrapped.numbers.daysAttended")}
          value={days_attended}
        />

        <StatItem
          icon={<TrendingUp className="size-5" />}
          label={t("wrapped.numbers.avgPerDay")}
          value={formatNumber(avg_beers)}
        />

        <StatItem
          icon={<DollarSign className="size-5" />}
          label={t("wrapped.numbers.totalSpent")}
          value={formatCurrency(total_spent)}
        />
      </SlideContent>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p className="flex items-center justify-center gap-1">
          {t(finalMessageKey)} <PartyPopper className="size-4" />
        </p>
      </div>
    </BaseSlide>
  );
}
