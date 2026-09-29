import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../story-text";

export function TentsSlide({ slide, animate }: { slide: StorySlideOf<"tents">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.favorite ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp numberOfLines={2} className="py-2">{copy(slide.favorite)}</StoryStamp>
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryBody className="text-3xl font-bold">{copy(slide.count)}</StoryBody>
        {slide.share ? <StoryNote className="text-base">{copy(slide.share)}</StoryNote> : null}
      </Reveal>
      <Reveal step={3} animate={animate}>
        <VStack space="sm">
          {slide.topTents.map((tent) => (
            <HStack key={tent.name} className="justify-between border-b border-wrapped-ink/15 pb-2">
              <StoryBody numberOfLines={2} className="flex-1 pr-3">{tent.name}</StoryBody>
              <StoryBody className="font-bold">{`${tent.visits}×`}</StoryBody>
            </HStack>
          ))}
        </VStack>
      </Reveal>
    </VStack>
  );
}
