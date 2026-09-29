import { cn } from "@prostcounter/ui";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryHeading } from "../story-text";

/** Cards lean alternately, like the photos on the people slide. */
const TILTS = ["-rotate-2", "rotate-2"];

export function CompareSlide({ slide, animate }: { slide: StorySlideOf<"compare">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="4xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-center text-4xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.rows.map((row, index) => (
        <Reveal key={row.caption.key} step={index + 1} animate={animate}>
          <VStack
            space="xs"
            className={cn(
              "mx-4 my-2 rounded-2xl border-2 border-wrapped-ink bg-white px-5 py-5",
              TILTS[index % TILTS.length],
            )}
          >
            <StoryBig className="text-center text-6xl">{copy(row.stat)}</StoryBig>
            <StoryBody className="text-center text-lg">{copy(row.caption)}</StoryBody>
          </VStack>
        </Reveal>
      ))}
    </VStack>
  );
}
