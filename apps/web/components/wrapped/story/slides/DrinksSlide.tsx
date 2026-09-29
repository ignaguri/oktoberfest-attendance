"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryNote } from "../StoryText";

/** One dot per drink; past this the row ends in "+N" instead of wrapping on and on. */
const MAX_DOTS = 20;

export function DrinksSlide({ slide, animate }: { slide: StorySlideOf<"drinks">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <div className="flex flex-col gap-4">
          {slide.breakdown.map((drink) => {
            const dots = Math.min(drink.count, MAX_DOTS);
            return (
              <div key={drink.drinkType} className={cn("flex flex-col gap-1", drink.count === 0 && "opacity-40")}>
                <StoryBody className="text-xl font-bold">{`${copy(drink.label)} · ${drink.count}`}</StoryBody>
                {dots > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {Array.from({ length: dots }, (_, index) => (
                      <span key={index} className="size-5 rounded-full border-2 border-wrapped-ink bg-wrapped-amber" />
                    ))}
                    {drink.count > MAX_DOTS ? (
                      <span className="ml-1 text-base font-bold text-wrapped-ink">{`+${drink.count - MAX_DOTS}`}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Reveal>
      <Reveal step={2} animate={animate}>
        {slide.top ? <StoryBody className="text-2xl">{copy(slide.top)}</StoryBody> : null}
        {slide.spent ? <StoryNote className="text-lg">{copy(slide.spent)}</StoryNote> : null}
      </Reveal>
    </div>
  );
}
