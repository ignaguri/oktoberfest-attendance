import type { AchievementCategory } from "@prostcounter/shared/achievements";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../story-text";

export function BadgesSlide({ slide, animate }: { slide: StorySlideOf<"badges">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
        <StoryStamp className="mt-3">{copy(slide.count)}</StoryStamp>
      </Reveal>
      {slide.top.map((badge, index) => (
        <Reveal key={badge.id} step={index + 1} animate={animate} kind="stamp">
          <HStack space="md" className="items-center">
            <AchievementBadge
              glyph={badge.icon}
              category={badge.category as AchievementCategory}
              tier={badge.tier as 1 | 2 | 3 | 4}
              isUnlocked
              size="md"
            />
            <StoryBody numberOfLines={2} className="flex-1 font-bold">{copy(badge.name)}</StoryBody>
          </HStack>
        </Reveal>
      ))}
    </VStack>
  );
}
