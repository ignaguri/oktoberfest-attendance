import { cn } from "@prostcounter/ui";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../story-text";

export function TentsSlide({ slide, animate }: { slide: StorySlideOf<"tents">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-center text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.favorite ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp numberOfLines={2} className="self-center py-2">{copy(slide.favorite)}</StoryStamp>
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryBody className="text-center text-4xl font-bold">{copy(slide.count)}</StoryBody>
        {slide.share ? <StoryNote className="text-center text-lg">{copy(slide.share)}</StoryNote> : null}
      </Reveal>
      <Reveal step={3} animate={animate}>
        <VStack space="xs">
          {slide.topTents.map((tent) => (
            // The home base is already the stamp; the amber row ties the two together instead of repeating it.
            <HStack
              key={tent.name}
              className={cn("items-center justify-between rounded-xl px-4 py-2.5", tent.isFavorite && "bg-wrapped-amber/25")}
            >
              <StoryBody numberOfLines={2} className={cn("flex-1 pr-3 text-xl", tent.isFavorite && "font-bold")}>
                {tent.name}
              </StoryBody>
              <StoryBody className="text-xl font-bold">{`${tent.visits}×`}</StoryBody>
            </HStack>
          ))}
        </VStack>
      </Reveal>
    </VStack>
  );
}
