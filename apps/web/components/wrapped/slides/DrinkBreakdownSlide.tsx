"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { motion } from "framer-motion";

import {
  BaseSlide,
  SlideContent,
  SlideSubtitle,
  SlideTitle,
} from "./BaseSlide";

interface DrinkBreakdownSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function DrinkBreakdownSlide({
  data,
  isActive = false,
}: DrinkBreakdownSlideProps) {
  const { t } = useTranslation();
  const breakdown = data.drink_stats?.breakdown?.slice(0, 4) ?? [];
  const topDrinkType = data.drink_stats?.top_drink_type;
  const totalDrinks = data.drink_stats?.total_drinks ?? 0;

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-amber-50 to-orange-50"
    >
      <SlideTitle>{t("wrapped.drinkBreakdown.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.drinkBreakdown.subtitle")}</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white p-4 text-center shadow">
            <p className="text-3xl font-bold text-amber-600">{totalDrinks}</p>
            <p className="text-sm text-gray-600">
              {t("wrapped.drinkBreakdown.totalDrinks")}
            </p>
          </div>
          {topDrinkType && (
            <div className="rounded-lg bg-white p-4 text-center shadow">
              <p className="text-2xl font-bold text-amber-600">
                {t(`wrapped.drinkBreakdown.drinkTypes.${topDrinkType}`)}
              </p>
              <p className="text-sm text-gray-600">
                {t("wrapped.drinkBreakdown.topDrink")}
              </p>
            </div>
          )}
        </div>

        {breakdown.length > 0 && (
          <div className="space-y-2">
            {breakdown.map((item, index) => (
              <motion.div
                key={item.drink_type}
                variants={{
                  hidden: { x: -20, opacity: 0 },
                  visible: { x: 0, opacity: 1 },
                }}
                transition={{ delay: 0.3 + index * 0.1 }}
                initial="hidden"
                animate={isActive ? "visible" : "hidden"}
                className="rounded-lg bg-white p-3 shadow"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {t(`wrapped.drinkBreakdown.drinkTypes.${item.drink_type}`)}
                  </span>
                  <span className="font-bold text-amber-600">
                    {item.percentage}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                  <motion.div
                    className="h-2 origin-left rounded-full bg-amber-500"
                    initial={{ scaleX: 0 }}
                    animate={isActive ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SlideContent>
    </BaseSlide>
  );
}
