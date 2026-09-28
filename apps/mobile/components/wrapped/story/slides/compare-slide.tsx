import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { View } from "react-native";

import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading } from "../story-text";

export function CompareSlide({ slide, animate }: { slide: StorySlideOf<"compare">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.rows.map((row, index) => (
        <Reveal key={row.key} step={index + 1} animate={animate}>
          <View className="border-l-4 border-wrapped-amber pl-4">
            <StoryBody className="text-xl">{copy(row)}</StoryBody>
          </View>
        </Reveal>
      ))}
    </VStack>
  );
}
