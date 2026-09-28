"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../StoryText";

export function TentsSlide({ slide, animate }: { slide: StorySlideOf<"tents">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.favorite ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp className="py-2">{copy(slide.favorite)}</StoryStamp>
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryBody className="text-3xl font-bold">{copy(slide.count)}</StoryBody>
        {slide.share ? <StoryNote className="text-base">{copy(slide.share)}</StoryNote> : null}
      </Reveal>
      <Reveal step={3} animate={animate}>
        <ul className="flex flex-col gap-2">
          {slide.topTents.map((tent) => (
            <li key={tent.name} className="flex justify-between border-b border-wrapped-ink/15 pb-2">
              <StoryBody className="line-clamp-2 flex-1 pr-3">{tent.name}</StoryBody>
              <StoryBody className="font-bold">{`${tent.visits}×`}</StoryBody>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
