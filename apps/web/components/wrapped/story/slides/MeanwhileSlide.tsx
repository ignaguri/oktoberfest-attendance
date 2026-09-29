"use client";

import {
  type StorySlideOf,
  useCountUp,
  useStoryCopy,
  useStoryLanguage,
  useStoryNumber,
} from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryKicker, StoryNote } from "../StoryText";

const TAG_TILTS = ["rotate-0", "rotate-2 ml-6", "-rotate-2 ml-2"];

export function MeanwhileSlide({ slide, animate }: { slide: StorySlideOf<"meanwhile">; animate: boolean }) {
  const copy = useStoryCopy();
  const language = useStoryLanguage();
  const formatNumber = useStoryNumber();
  const mugs = useCountUp(slide.mugs ?? 0, animate, 1200);
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryKicker>{copy(slide.kicker)}</StoryKicker>
        {slide.mugs !== null && slide.mugsLine ? (
          <>
            <StoryBig className="mt-2 text-7xl">{formatNumber(mugs, 0)}</StoryBig>
            <StoryBody className="font-bold">{copy(slide.mugsLine)}</StoryBody>
          </>
        ) : null}
      </Reveal>
      <div className="flex flex-col gap-3">
        {slide.finds.map((find, index) => (
          <Reveal key={`${index}-${find.en}`} step={index + 1} animate={animate} kind="stamp">
            <div
              className={cn(
                "inline-block rounded-md border-2 border-wrapped-ink bg-white px-3 py-2 shadow-[3px_3px_0_#16325C]",
                TAG_TILTS[index % TAG_TILTS.length],
              )}
            >
              <p className="text-[10px] font-bold tracking-widest text-wrapped-ink/60 uppercase">{copy(slide.findsLabel)}</p>
              <p className="text-base font-semibold text-wrapped-ink">{find[language] ?? find.en}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        {slide.lostItems ? <StoryNote>{copy(slide.lostItems)}</StoryNote> : null}
        <StoryNote>{copy(slide.source)}</StoryNote>
      </div>
    </div>
  );
}
