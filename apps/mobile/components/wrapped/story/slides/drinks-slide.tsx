import { cn } from "@prostcounter/ui";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryNote } from "../story-text";

const DOTS = 10;

export function DrinksSlide({ slide, animate }: { slide: StorySlideOf<"drinks">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <VStack space="md">
          {slide.breakdown.map((drink) => {
            const filled = Math.round(drink.percentage / DOTS);
            return (
              <VStack key={drink.drinkType} space="xs">
                <StoryBody className="text-base font-bold">{`${copy(drink.label)} · ${drink.count}`}</StoryBody>
                <HStack space="xs">
                  {Array.from({ length: DOTS }, (_, index) => (
                    <View
                      key={index}
                      className={cn(
                        "h-4 w-4 rounded-full border-2 border-wrapped-ink",
                        index < filled ? "bg-wrapped-amber" : "bg-transparent",
                      )}
                    />
                  ))}
                </HStack>
              </VStack>
            );
          })}
        </VStack>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <VStack space="xs">
          {slide.top ? <StoryBody>{copy(slide.top)}</StoryBody> : null}
          {slide.spent ? <StoryNote className="text-base">{copy(slide.spent)}</StoryNote> : null}
        </VStack>
      </Reveal>
    </VStack>
  );
}
