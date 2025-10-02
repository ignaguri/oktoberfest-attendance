"use client";

import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import { sortAchievements, calculateTotalPoints } from "@/lib/wrapped/utils";
import { motion } from "framer-motion";

import type { AchievementRarity } from "@/lib/types/achievements";
import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface AchievementsSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function AchievementsSlide({
  data,
  isActive = false,
}: AchievementsSlideProps) {
  const achievements = sortAchievements(data.achievements);
  const totalPoints = calculateTotalPoints(data.achievements);

  if (achievements.length === 0) {
    return (
      <BaseSlide
        isActive={isActive}
        className="bg-gradient-to-br from-violet-50 to-purple-50"
      >
        <SlideTitle>Achievements</SlideTitle>
        <p className="text-gray-600">No achievements unlocked yet</p>
      </BaseSlide>
    );
  }

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-violet-50 to-purple-50"
    >
      <SlideTitle>Achievements unlocked</SlideTitle>
      <SlideSubtitle>{achievements.length} badges earned</SlideSubtitle>

      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="rounded-lg bg-white p-4 shadow text-center">
          <p className="text-3xl font-bold text-yellow-600">{totalPoints}</p>
          <p className="text-sm text-gray-600">Total points</p>
        </div>

        <div className="flex flex-col gap-2 max-h-[50dvh] overflow-y-auto">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              variants={{
                hidden: { scale: 0 },
                visible: { scale: 1 },
              }}
              transition={{ delay: 0.3 + index * 0.05, type: "spring" }}
              initial="hidden"
              animate={isActive ? "visible" : "hidden"}
              className="flex justify-center"
            >
              <AchievementBadge
                name={achievement.name}
                icon={achievement.icon}
                rarity={achievement.rarity as AchievementRarity}
                points={achievement.points}
                isUnlocked={true}
                size="md"
                showPoints={true}
                className="w-full justify-center text-center"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </BaseSlide>
  );
}
