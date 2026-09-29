"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../StoryText";

export function TentsSlide({ slide, animate }: { slide: StorySlideOf<"tents">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.favorite ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp className="line-clamp-2 self-center py-2">{copy(slide.favorite)}</StoryStamp>
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryBody className="text-4xl font-bold">{copy(slide.count)}</StoryBody>
        {slide.share ? <StoryNote className="text-lg">{copy(slide.share)}</StoryNote> : null}
      </Reveal>
      <Reveal step={3} animate={animate}>
        <ul className="flex flex-col gap-1 text-left">
          {slide.topTents.map((tent) => (
            // The home base is already the stamp; the amber row ties the two together instead of repeating it.
            <li
              key={tent.name}
              className={cn("flex items-center justify-between rounded-xl px-4 py-2.5", tent.isFavorite && "bg-wrapped-amber/25")}
            >
              <StoryBody className={cn("line-clamp-2 flex-1 pr-3 text-xl", tent.isFavorite && "font-bold")}>
                {tent.name}
              </StoryBody>
              <StoryBody className="text-xl font-bold">{`${tent.visits}×`}</StoryBody>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
