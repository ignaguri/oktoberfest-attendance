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
  const photos = slide.photos
    .map((photo) => ({ id: photo.id, src: getBeerPictureUrl(photo.pictureUrl) }))
    .filter((photo) => photo.src && !failedIds.includes(photo.id));
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-5xl">{copy(slide.title)}</StoryHeading>
        {slide.groups ? <StoryBody className="mt-2 text-4xl font-bold">{copy(slide.groups)}</StoryBody> : null}
      </Reveal>
      {slide.bestPlacing ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp className="line-clamp-2 self-center py-2">{copy(slide.bestPlacing)}</StoryStamp>
        </Reveal>
      ) : null}
      {slide.photosLabel && photos.length > 0 ? (
        <Reveal step={2} animate={animate}>
          <StoryKicker className="mb-4 text-sm">{copy(slide.photosLabel)}</StoryKicker>
          {/* Two columns across the full width, centred, so a lone last photo sits in the middle. */}
          <div className="flex flex-wrap justify-center gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className={cn("w-[46%] rounded-md bg-white p-1.5", TILTS[index % TILTS.length])}>
                <Image
                  src={photo.src as string}
                  alt=""
                  unoptimized
                  width={320}
                  height={320}
                  className="aspect-square w-full rounded object-cover"
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
