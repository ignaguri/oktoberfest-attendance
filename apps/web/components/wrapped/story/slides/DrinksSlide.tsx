"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryNote } from "../StoryText";

const DOTS = 10;

export function DrinksSlide({ slide, animate }: { slide: StorySlideOf<"drinks">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <div className="flex flex-col gap-4">
          {slide.breakdown.map((drink) => {
            const filled = Math.round(drink.percentage / DOTS);
            return (
              <div key={drink.drinkType} className="flex flex-col gap-1">
                <StoryBody className="text-base font-bold">{`${copy(drink.label)} · ${drink.count}`}</StoryBody>
                <div className="flex gap-1">
                  {Array.from({ length: DOTS }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "size-4 rounded-full border-2 border-wrapped-ink",
                        index < filled ? "bg-wrapped-amber" : "bg-transparent",
                      )}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
      <Reveal step={2} animate={animate}>
        {slide.top ? <StoryBody>{copy(slide.top)}</StoryBody> : null}
        {slide.spent ? <StoryNote className="text-base">{copy(slide.spent)}</StoryNote> : null}
      </Reveal>
    </div>
  );
}
