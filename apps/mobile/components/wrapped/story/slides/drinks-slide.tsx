import { cn } from "@prostcounter/ui";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { View } from "react-native";

import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryNote } from "../story-text";

/** One dot per drink; past this the row ends in "+N" instead of wrapping on and on. */
const MAX_DOTS = 20;

export function DrinksSlide({ slide, animate }: { slide: StorySlideOf<"drinks">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-center text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <VStack space="md">
          {slide.breakdown.map((drink) => {
            const dots = Math.min(drink.count, MAX_DOTS);
            return (
              <VStack key={drink.drinkType} space="xs" className={cn(drink.count === 0 && "opacity-40")}>
                <StoryBody className="text-center text-xl font-bold">{`${copy(drink.label)} · ${drink.count}`}</StoryBody>
                {dots > 0 ? (
                  <View className="flex-row flex-wrap items-center justify-center gap-1">
                    {Array.from({ length: dots }, (_, index) => (
                      <View key={index} className="h-5 w-5 rounded-full border-2 border-wrapped-ink bg-wrapped-amber" />
                    ))}
                    {drink.count > MAX_DOTS ? (
                      <StoryBody className="ml-1 text-base font-bold">{`+${drink.count - MAX_DOTS}`}</StoryBody>
                    ) : null}
                  </View>
                ) : null}
              </VStack>
            );
          })}
        </VStack>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <VStack space="xs">
          {slide.top ? <StoryBody className="text-center text-2xl">{copy(slide.top)}</StoryBody> : null}
          {slide.spent ? <StoryNote className="text-center text-lg">{copy(slide.spent)}</StoryNote> : null}
        </VStack>
      </Reveal>
    </VStack>
  );
}
