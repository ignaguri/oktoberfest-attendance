"use client";

import { motion } from "framer-motion";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface RankingsSlideProps {
  data: WrappedData;
}

export function RankingsSlide({ data }: RankingsSlideProps) {
  const { top_3_rankings } = data.social_stats;

  if (top_3_rankings.length === 0) {
    return (
      <BaseSlide className="bg-gradient-to-br from-orange-50 to-red-50">
        <SlideTitle>Group Rankings</SlideTitle>
        <p className="text-gray-600">No top 3 rankings yet</p>
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
      <SlideTitle>Group Rankings</SlideTitle>
      <SlideSubtitle>You&apos;re in the top 3!</SlideSubtitle>

      <div className="w-full max-w-2xl space-y-4">
        {top_3_rankings.map((ranking, index) => (
          <motion.div
            key={ranking.group_name}
            variants={{
              hidden: { x: -50, opacity: 0 },
              visible: { x: 0, opacity: 1 },
            }}
            transition={{ delay: 0.3 + index * 0.15 }}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between rounded-lg bg-white p-4 shadow-lg"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">
                {getMedalEmoji(ranking.position)}
              </span>
              <div>
                <p className="font-semibold text-gray-800">
                  {ranking.group_name}
                </p>
                <p className="text-sm text-gray-500">
                  Position #{ranking.position}
                </p>
              </div>
            </div>
            <div className="text-3xl font-bold text-yellow-600">
              #{ranking.position}
            </div>
          </motion.div>
        ))}
      </div>
    </BaseSlide>
  );
}
