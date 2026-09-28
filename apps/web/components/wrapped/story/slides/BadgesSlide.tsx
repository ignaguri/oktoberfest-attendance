"use client";

import type { AchievementCategory } from "@prostcounter/shared/achievements";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import type { AchievementRarity } from "@/lib/types/achievements";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../StoryText";

export function BadgesSlide({ slide, animate }: { slide: StorySlideOf<"badges">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
        <StoryStamp className="mt-3">{copy(slide.count)}</StoryStamp>
      </Reveal>
      {slide.top.map((badge, index) => (
        <Reveal key={badge.id} step={index + 1} animate={animate} kind="stamp">
          <div className="flex items-center gap-4">
            <AchievementBadge
              name={badge.name}
              icon={badge.icon}
              category={badge.category as AchievementCategory}
              tier={badge.tier as 1 | 2 | 3 | 4}
              rarity={badge.rarity as AchievementRarity}
              points={badge.points}
              isUnlocked
              size="md"
            />
            <StoryBody className="line-clamp-2 flex-1 font-bold">{badge.name}</StoryBody>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
