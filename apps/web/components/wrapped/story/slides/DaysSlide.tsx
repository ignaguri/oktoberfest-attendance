"use client";

import { formatWrappedDate, type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../StoryText";

const COLUMN_DOTS = 8;

function filledDots(beers: number, maxBeers: number): number {
  if (beers <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((beers / maxBeers) * COLUMN_DOTS));
}

export function DaysSlide({ slide, animate }: { slide: StorySlideOf<"days">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <div className="flex items-end justify-between">
          {slide.bars.map((bar) => {
            const filled = filledDots(bar.beers, slide.maxBeers);
            return (
              <div key={bar.date} className="flex flex-col items-center gap-1">
                {Array.from({ length: COLUMN_DOTS }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "size-1.5 rounded-full",
                      COLUMN_DOTS - index <= filled ? "bg-wrapped-ink" : "bg-wrapped-ink/10",
                    )}
                  />
                ))}
                <span className={cn("mt-1 h-1 w-3 rounded-full", bar.attended ? "bg-wrapped-amber" : "bg-transparent")} />
              </div>
            );
          })}
        </div>
      </Reveal>
      {slide.bestDay ? (
        <Reveal step={2} animate={animate}>
          <div className="flex flex-col gap-2">
            <StoryStamp>{formatWrappedDate(slide.bestDay.date)}</StoryStamp>
            <StoryBody className="text-2xl font-bold">{copy(slide.bestDay.callout)}</StoryBody>
            <StoryBody>{copy(slide.bestDay.details)}</StoryBody>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
