"use client";

import type { AchievementCategory } from "@prostcounter/shared/achievements";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import type { AchievementRarity } from "@/lib/types/achievements";
import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryHeading, StoryNote } from "../StoryText";

type Badge = StorySlideOf<"badges">["top"][number];

/** Podium order: the top badge in the middle, second on the left, third on the right. */
function podium(top: Badge[]): Badge[] {
  return top.length === 3 ? [top[1], top[0], top[2]] : top;
}

export function BadgesSlide({ slide, animate }: { slide: StorySlideOf<"badges">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-5xl">{copy(slide.title)}</StoryHeading>
        <StoryBig className="mt-4 text-8xl">{copy(slide.count.stat)}</StoryBig>
        <StoryBody className="text-xl">{copy(slide.count.caption)}</StoryBody>
      </Reveal>
      <div className="flex items-end justify-center gap-3">
        {podium(slide.top).map((badge) => {
          const rank = slide.top.indexOf(badge);
          return (
            // Revealed in rank order, so the winner lands first. Names reserve two lines, so
            // a wrapped name doesn't lift its badge level with the raised winner.
            <Reveal key={badge.id} step={rank + 1} animate={animate} kind="stamp">
              <div className={cn("flex w-28 flex-col items-center gap-2", rank === 0 && slide.top.length === 3 && "mb-6")}>
                <AchievementBadge
                  name=""
                  icon={badge.icon}
                  category={badge.category as AchievementCategory}
                  tier={badge.tier as 1 | 2 | 3 | 4}
                  rarity={badge.rarity as AchievementRarity}
                  points={badge.points}
                  isUnlocked
                  size="xl"
                />
                <StoryBody className="line-clamp-2 h-10 text-sm leading-snug font-bold">{copy(badge.name)}</StoryBody>
              </div>
            </Reveal>
          );
        })}
      </div>
      {slide.more ? (
        <Reveal step={slide.top.length} animate={animate}>
          <StoryNote className="text-base">{copy(slide.more)}</StoryNote>
        </Reveal>
      ) : null}
    </div>
  );
}
