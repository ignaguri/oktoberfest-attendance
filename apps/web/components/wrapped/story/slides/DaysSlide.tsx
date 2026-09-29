"use client";

import {
  formatWrappedDate,
  formatWrappedShortDate,
  type StorySlideOf,
  useStoryCopy,
} from "@prostcounter/shared/wrapped";
import { Tent } from "lucide-react";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../StoryText";

/** One dot per beer, as on the drinks slide; taller days end in a "+". */
const MAX_COLUMN_DOTS = 12;
/** A faint track keeps light festivals from looking like a flat line. */
const MIN_TRACK_DOTS = 4;
/** One tent icon per tent visited; nobody really does more than two a day. */
const MAX_TENT_ICONS = 3;

export function DaysSlide({ slide, animate }: { slide: StorySlideOf<"days">; animate: boolean }) {
  const copy = useStoryCopy();
  const trackDots = Math.min(Math.max(slide.maxBeers, MIN_TRACK_DOTS), MAX_COLUMN_DOTS);
  const firstDate = slide.bars[0]?.date;
  const lastDate = slide.bars[slide.bars.length - 1]?.date;
  const tentRows = Math.min(Math.max(0, ...slide.bars.map((bar) => bar.tents)), MAX_TENT_ICONS);
  // Like the beer "+": one extra slot in every column, so the columns stay the same height.
  const hasTentOverflow = slide.bars.some((bar) => bar.tents > MAX_TENT_ICONS);
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            {slide.bars.map((bar) => {
              const filled = Math.min(bar.beers, MAX_COLUMN_DOTS);
              const isBest = bar.date === slide.bestDay?.date;
              return (
                <div
                  key={bar.date}
                  className={cn(
                    "mx-px flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md border py-1",
                    bar.attended ? "border-dotted border-wrapped-ink/50" : "border-transparent",
                  )}
                >
                  {bar.beers > MAX_COLUMN_DOTS ? (
                    <span className="text-xs leading-none font-bold text-wrapped-ink">+</span>
                  ) : null}
                  {Array.from({ length: trackDots }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "aspect-square w-full max-w-2.5 rounded-full",
                        trackDots - index > filled
                          ? "bg-wrapped-ink/10"
                          : isBest
                            ? "bg-wrapped-amber"
                            : "bg-wrapped-ink",
                      )}
                    />
                  ))}
                  {/* Same slot count in every column, so a two-tent day doesn't lift its dots. */}
                  {Array.from({ length: tentRows }, (_, index) => (
                    <span key={`tent-${index}`} className="flex aspect-square w-full max-w-4 items-center justify-center">
                      {index < bar.tents ? (
                        <Tent className="size-full text-wrapped-amber" strokeWidth={2.5} aria-hidden />
                      ) : null}
                    </span>
                  ))}
                  {hasTentOverflow ? (
                    <span className="flex aspect-square w-full max-w-4 items-center justify-center text-sm leading-none font-extrabold text-wrapped-amber">
                      {bar.tents > MAX_TENT_ICONS ? "+" : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {firstDate && lastDate ? (
            <div className="flex justify-between">
              <StoryNote>{formatWrappedShortDate(firstDate)}</StoryNote>
              <StoryNote>{formatWrappedShortDate(lastDate)}</StoryNote>
            </div>
          ) : null}
        </div>
      </Reveal>
      {slide.bestDay ? (
        <Reveal step={2} animate={animate}>
          <div className="flex flex-col items-center gap-3">
            <StoryStamp className="self-center">{formatWrappedDate(slide.bestDay.date)}</StoryStamp>
            <StoryBody className="text-2xl font-bold">{`${copy(slide.bestDay.callout)} ${copy(slide.bestDay.details)}`}</StoryBody>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
