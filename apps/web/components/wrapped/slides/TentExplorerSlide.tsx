"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { getTopTents } from "@prostcounter/shared/wrapped";
import { motion } from "framer-motion";

import { BaseSlide, SlideContent, SlideSubtitle, SlideTitle } from "./BaseSlide";

interface TentExplorerSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function TentExplorerSlide({ data, isActive = false }: TentExplorerSlideProps) {
  const { t } = useTranslation();
  const { uniqueTents, favoriteTent, tentDiversityPct, tentBreakdown } = data.tentStats;
  const topTents = getTopTents(tentBreakdown, 3);

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-green-50 to-emerald-50">
      <SlideTitle>{t("wrapped.tentExplorer.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.tentExplorer.subtitle")}</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white p-4 text-center shadow">
            <p className="text-3xl font-bold text-yellow-600">{uniqueTents}</p>
            <p className="text-sm text-gray-600">{t("wrapped.tentExplorer.uniqueTents")}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow">
            <p className="text-3xl font-bold text-yellow-600">{tentDiversityPct.toFixed(0)}%</p>
            <p className="text-sm text-gray-600">{t("wrapped.tentExplorer.diversity")}</p>
          </div>
        </div>

        {favoriteTent && (
          <div className="rounded-lg bg-white p-4 text-center shadow">
            <p className="mb-1 text-sm text-gray-600">{t("wrapped.tentExplorer.favorite")}</p>
            <p className="text-2xl font-bold text-yellow-600">{favoriteTent}</p>
          </div>
        )}

        {topTents.length > 0 && (
          <div>
            <h3 className="mb-3 text-center text-lg font-semibold text-gray-700">
              {t("wrapped.tentExplorer.topTents")}
            </h3>
            <div className="space-y-2">
              {topTents.map((tent, index) => (
                <motion.div
                  key={`tent-${tent.tentName}-${index}`}
                  variants={{
                    hidden: { x: -20, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  initial="hidden"
                  animate={isActive ? "visible" : "hidden"}
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow"
                >
                  <span className="font-medium text-gray-700">{tent.tentName}</span>
                  <span className="font-bold text-yellow-600">{tent.visitCount}x</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </SlideContent>
    </BaseSlide>
  );
}
