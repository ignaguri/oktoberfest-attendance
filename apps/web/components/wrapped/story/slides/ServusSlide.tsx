"use client";

import { formatWrappedDate, type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import Image from "next/image";

import { getAvatarUrl } from "@/lib/image-urls";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../StoryText";

export function ServusSlide({ slide, animate }: { slide: StorySlideOf<"servus">; animate: boolean }) {
  const copy = useStoryCopy();
  const avatarUri = getAvatarUrl(slide.avatarUrl);
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryStamp>{`${formatWrappedDate(slide.startDate)} – ${formatWrappedDate(slide.endDate)}`}</StoryStamp>
      </Reveal>
      {avatarUri ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <Image src={avatarUri} alt="" width={96} height={96} unoptimized className="size-24 rounded-full border-4 border-wrapped-ink object-cover" />
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryHeading className="line-clamp-2 text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={3} animate={animate}>
        <StoryBody>{copy(slide.subtitle)}</StoryBody>
      </Reveal>
    </div>
  );
}
