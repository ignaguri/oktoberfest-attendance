import { cn } from "@prostcounter/ui";
import { formatWrappedDate, type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../story-text";

const COLUMN_DOTS = 8;

function filledDots(beers: number, maxBeers: number): number {
  if (beers <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((beers / maxBeers) * COLUMN_DOTS));
}

export function DaysSlide({ slide, animate }: { slide: StorySlideOf<"days">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <HStack className="items-end justify-between">
          {slide.bars.map((bar) => {
            const filled = filledDots(bar.beers, slide.maxBeers);
            return (
              <VStack key={bar.date} className="items-center" space="xs">
                {Array.from({ length: COLUMN_DOTS }, (_, index) => (
                  <View
                    key={index}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      COLUMN_DOTS - index <= filled ? "bg-wrapped-ink" : "bg-wrapped-ink/10",
                    )}
                  />
                ))}
                <View className={cn("mt-1 h-1 w-3 rounded-full", bar.attended ? "bg-wrapped-amber" : "bg-transparent")} />
              </VStack>
            );
          })}
        </HStack>
      </Reveal>
      {slide.bestDay ? (
        <Reveal step={2} animate={animate}>
          <VStack space="sm">
            <StoryStamp>{formatWrappedDate(slide.bestDay.date)}</StoryStamp>
            <StoryBody className="text-2xl font-bold">{copy(slide.bestDay.callout)}</StoryBody>
            <StoryBody>{copy(slide.bestDay.details)}</StoryBody>
          </VStack>
        </Reveal>
      ) : null}
    </VStack>
  );
}
