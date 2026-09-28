"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { motion } from "framer-motion";
import { Beer, CalendarDays, DiamondPercent, Globe, Users } from "lucide-react";

import { BaseSlide, SlideTitle } from "./BaseSlide";

interface RankingsSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function RankingsSlide({ data, isActive = false }: RankingsSlideProps) {
  const { t } = useTranslation();
  const { topRankings } = data.socialStats;
  const { daysAttended, totalBeers, avgBeers } = data.globalLeaderboardPositions;

  const hasGroupRankings = topRankings.length > 0;
  const hasGlobalPositions = daysAttended !== null || totalBeers !== null || avgBeers !== null;

  if (!hasGroupRankings && !hasGlobalPositions) {
    return (
      <BaseSlide isActive={isActive} className="bg-gradient-to-br from-orange-50 to-red-50">
        <SlideTitle>{t("wrapped.rankings.title")}</SlideTitle>
        <p className="text-gray-600">{t("wrapped.rankings.subtitle")}</p>
      </BaseSlide>
    );
  }

  const getMedalEmoji = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return "🏅";
  };

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-orange-50 to-red-50">
      <SlideTitle>{t("wrapped.rankings.title")}</SlideTitle>

      <div className="flex w-full max-w-2xl flex-col gap-6">
        {/* Group Rankings Section */}
        {hasGroupRankings && (
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center justify-center gap-2 text-lg font-semibold text-gray-800">
              <Users className="size-5" />
              {t("wrapped.rankings.groupRankings")}
            </h3>
            <div className="flex flex-col gap-2">
              {topRankings.slice(0, 3).map((ranking, index) => (
                <motion.div
                  key={ranking.groupName}
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.3 + index * 0.15 }}
                  initial="hidden"
                  animate={isActive ? "visible" : "hidden"}
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow-lg"
                >
                  <span className="text-4xl">{getMedalEmoji(ranking.position)}</span>
                  <p className="line-clamp-2 font-semibold text-gray-800">{ranking.groupName}</p>
                  <span className="text-3xl font-bold text-yellow-600">#{ranking.position}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Global Rankings Section */}
        {hasGlobalPositions && (
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center justify-center gap-2 text-lg font-semibold text-gray-800">
              <Globe className="size-5" />
              {t("wrapped.rankings.globalRankings")}
            </h3>
            <div className="flex flex-col gap-2">
              {daysAttended !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.6 }}
                  initial="hidden"
                  animate={isActive ? "visible" : "hidden"}
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <CalendarDays className="size-8" />
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-gray-800">Days attended</p>
                    <p className="text-sm text-gray-500">Position #{daysAttended}</p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">#{daysAttended}</div>
                </motion.div>
              )}

              {totalBeers !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.7 }}
                  initial="hidden"
                  animate={isActive ? "visible" : "hidden"}
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <Beer className="size-8" />
                  <div>
                    <p className="font-semibold text-gray-800">Total beers</p>
                    <p className="text-sm text-gray-500">Position #{totalBeers}</p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">#{totalBeers}</div>
                </motion.div>
              )}

              {avgBeers !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.8 }}
                  initial="hidden"
                  animate={isActive ? "visible" : "hidden"}
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <DiamondPercent className="size-8" />
                  <div>
                    <p className="font-semibold text-gray-800">Average beers</p>
                    <p className="text-sm text-gray-500">Position #{avgBeers}</p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">#{avgBeers}</div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseSlide>
  );
}
