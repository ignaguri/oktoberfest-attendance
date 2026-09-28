"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import Image from "next/image";
import { useState } from "react";

import { getBeerPictureUrl } from "@/lib/image-urls";
import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryKicker, StoryStamp } from "../StoryText";

const TILTS = ["-rotate-3", "rotate-2", "rotate-1", "-rotate-2"];

export function PeopleSlide({ slide, animate }: { slide: StorySlideOf<"people">; animate: boolean }) {
  const copy = useStoryCopy();
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const photos = slide.photos.filter((photo) => !failedIds.includes(photo.id));
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
        {slide.groups ? <StoryBody>{copy(slide.groups)}</StoryBody> : null}
      </Reveal>
      {slide.bestPlacing ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp className="py-2">{copy(slide.bestPlacing)}</StoryStamp>
        </Reveal>
      ) : null}
      {slide.photosLabel && photos.length > 0 ? (
        <Reveal step={2} animate={animate}>
          <StoryKicker className="mb-3">{copy(slide.photosLabel)}</StoryKicker>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div key={photo.id} className={cn("rounded-md bg-white p-1.5", TILTS[index % TILTS.length])}>
                <Image
                  src={getBeerPictureUrl(photo.pictureUrl) ?? ""}
                  alt=""
                  width={128}
                  height={128}
                  className="size-32 rounded object-cover"
                  onError={() => setFailedIds((ids) => [...ids, photo.id])}
                />
              </div>
            ))}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
