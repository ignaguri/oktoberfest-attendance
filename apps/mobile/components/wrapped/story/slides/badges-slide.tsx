import type { AchievementCategory } from "@prostcounter/shared/achievements";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";

import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryHeading, StoryNote } from "../story-text";

type Badge = StorySlideOf<"badges">["top"][number];

/** Podium order: the top badge in the middle, second on the left, third on the right. */
function podium(top: Badge[]): Badge[] {
  return top.length === 3 ? [top[1], top[0], top[2]] : top;
}

export function BadgesSlide({ slide, animate }: { slide: StorySlideOf<"badges">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="2xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-center text-5xl">{copy(slide.title)}</StoryHeading>
        <StoryBig className="mt-4 text-center text-8xl">{copy(slide.count.stat)}</StoryBig>
        <StoryBody className="text-center text-xl">{copy(slide.count.caption)}</StoryBody>
      </Reveal>
      <HStack space="md" className="items-end justify-center">
        {podium(slide.top).map((badge) => {
          const rank = slide.top.indexOf(badge);
          return (
            // Revealed in rank order, so the winner lands first. Names reserve two lines, so
            // a wrapped name doesn't lift its badge level with the raised winner.
            <Reveal key={badge.id} step={rank + 1} animate={animate} kind="stamp">
              <VStack space="sm" className={cn("w-28 items-center", rank === 0 && slide.top.length === 3 && "mb-6")}>
                <AchievementBadge
                  glyph={badge.icon}
                  category={badge.category as AchievementCategory}
                  tier={badge.tier as 1 | 2 | 3 | 4}
                  isUnlocked
                  size="xl"
                />
                <StoryBody numberOfLines={2} className="h-10 text-center text-sm font-bold leading-snug">
                  {copy(badge.name)}
                </StoryBody>
              </VStack>
            </Reveal>
          );
        })}
      </HStack>
      {slide.more ? (
        <Reveal step={slide.top.length} animate={animate}>
          <StoryNote className="text-center text-base">{copy(slide.more)}</StoryNote>
        </Reveal>
      ) : null}
    </VStack>
  );
}
