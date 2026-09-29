import { type StorySlideOf, useCountUp, useStoryCopy, useStoryLanguage, useStoryNumber } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryKicker, StoryNote } from "../story-text";

const TAG_TILTS = ["rotate-0", "rotate-2 ml-6", "-rotate-2 ml-2"];

export function MeanwhileSlide({ slide, animate }: { slide: StorySlideOf<"meanwhile">; animate: boolean }) {
  const copy = useStoryCopy();
  const language = useStoryLanguage();
  const formatNumber = useStoryNumber();
  const mugs = useCountUp(slide.mugs ?? 0, animate, 1200);

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryKicker>{copy(slide.kicker)}</StoryKicker>
        {slide.mugs !== null && slide.mugsLine ? (
          <>
            <StoryBig className="mt-2 text-7xl">{formatNumber(mugs, 0)}</StoryBig>
            <StoryBody className="font-bold">{copy(slide.mugsLine)}</StoryBody>
          </>
        ) : null}
      </Reveal>
      <VStack space="md">
        {slide.finds.map((find, index) => (
          <Reveal key={`${index}-${find.en}`} step={index + 1} animate={animate} kind="stamp">
            <View
              className={cn(
                "self-start rounded-md border-2 border-wrapped-ink bg-white px-3 py-2",
                TAG_TILTS[index % TAG_TILTS.length],
              )}
            >
              <Text className="text-2xs font-bold uppercase tracking-widest text-wrapped-ink/60">
                {copy(slide.findsLabel)}
              </Text>
              <Text className="text-base font-semibold text-wrapped-ink">{find[language] ?? find.en}</Text>
            </View>
          </Reveal>
        ))}
      </VStack>
      <VStack space="xs" className="mt-auto">
        {slide.lostItems ? <StoryNote>{copy(slide.lostItems)}</StoryNote> : null}
        <StoryNote>{copy(slide.source)}</StoryNote>
      </VStack>
    </VStack>
  );
}
