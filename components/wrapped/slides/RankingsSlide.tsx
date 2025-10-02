"use client";

import { motion } from "framer-motion";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle } from "./BaseSlide";

interface RankingsSlideProps {
  data: WrappedData;
}

export function RankingsSlide({ data }: RankingsSlideProps) {
  const { top_3_rankings } = data.social_stats;
  const { days_attended, total_beers, avg_beers } =
    data.global_leaderboard_positions;

  const hasGroupRankings = top_3_rankings.length > 0;
  const hasGlobalPositions =
    days_attended !== null || total_beers !== null || avg_beers !== null;

  if (!hasGroupRankings && !hasGlobalPositions) {
    return (
      <BaseSlide className="bg-gradient-to-br from-orange-50 to-red-50">
        <SlideTitle>Your rankings</SlideTitle>
        <p className="text-gray-600">No rankings available yet</p>
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
    <BaseSlide className="bg-gradient-to-br from-orange-50 to-red-50">
      <SlideTitle>Your rankings</SlideTitle>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Group Rankings Section */}
        {hasGroupRankings && (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center justify-center gap-2">
              <span className="text-xl">👥</span>
              Group rankings
            </h3>
            <div className="flex flex-col gap-2">
              {top_3_rankings.slice(0, 3).map((ranking, index) => (
                <motion.div
                  key={ranking.group_name}
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.3 + index * 0.15 }}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow-lg"
                >
                  <span className="text-4xl">
                    {getMedalEmoji(ranking.position)}
                  </span>
                  <p className="font-semibold text-gray-800 line-clamp-2">
                    {ranking.group_name}
                  </p>
                  <span className="text-3xl font-bold text-yellow-600">
                    #{ranking.position}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Global Rankings Section */}
        {hasGlobalPositions && (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center justify-center gap-2">
              <span className="text-xl">🌍</span>
              Global rankings
            </h3>
            <div className="flex flex-col gap-2">
              {days_attended !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.6 }}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <span className="text-4xl">📅</span>
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-gray-800">Days attended</p>
                    <p className="text-sm text-gray-500">
                      Position #{days_attended}
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">
                    #{days_attended}
                  </div>
                </motion.div>
              )}

              {total_beers !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.7 }}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <span className="text-4xl">🍺</span>
                  <div>
                    <p className="font-semibold text-gray-800">Total beers</p>
                    <p className="text-sm text-gray-500">
                      Position #{total_beers}
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">
                    #{total_beers}
                  </div>
                </motion.div>
              )}

              {avg_beers !== null && (
                <motion.div
                  variants={{
                    hidden: { x: -50, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.8 }}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                >
                  <span className="text-4xl">⚡</span>
                  <div>
                    <p className="font-semibold text-gray-800">Average beers</p>
                    <p className="text-sm text-gray-500">
                      Position #{avg_beers}
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600">
                    #{avg_beers}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseSlide>
  );
}
