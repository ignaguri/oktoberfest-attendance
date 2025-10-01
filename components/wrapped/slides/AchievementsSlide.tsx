"use client";

import { RARITY_COLORS } from "@/lib/wrapped/config";
import { sortAchievements, calculateTotalPoints } from "@/lib/wrapped/utils";
import { motion } from "framer-motion";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface AchievementsSlideProps {
  data: WrappedData;
}

export function AchievementsSlide({ data }: AchievementsSlideProps) {
  const achievements = sortAchievements(data.achievements);
  const totalPoints = calculateTotalPoints(data.achievements);

  if (achievements.length === 0) {
    return (
      <BaseSlide className="bg-gradient-to-br from-violet-50 to-purple-50">
        <SlideTitle>Achievements</SlideTitle>
        <p className="text-gray-600">No achievements unlocked yet</p>
      </BaseSlide>
    );
  }

  return (
    <BaseSlide className="bg-gradient-to-br from-violet-50 to-purple-50">
      <SlideTitle>Achievement Unlocked</SlideTitle>
      <SlideSubtitle>{achievements.length} badges earned</SlideSubtitle>

      <div className="w-full max-w-2xl space-y-6">
        <div className="rounded-lg bg-white p-4 shadow text-center">
          <p className="text-3xl font-bold text-yellow-600">{totalPoints}</p>
          <p className="text-sm text-gray-600">Total Points</p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              variants={{
                hidden: { scale: 0 },
                visible: { scale: 1 },
              }}
              transition={{ delay: 0.3 + index * 0.05, type: "spring" }}
              initial="hidden"
              animate="visible"
              className="rounded-lg bg-white p-4 shadow flex flex-col items-center gap-2"
              style={{
                borderTop: `3px solid ${RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common}`,
              }}
            >
              <span className="text-3xl">{achievement.icon}</span>
              <span className="text-sm font-semibold text-center text-gray-700">
                {achievement.name}
              </span>
              <span className="text-xs text-gray-500">
                {achievement.points} pts
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </BaseSlide>
  );
}
