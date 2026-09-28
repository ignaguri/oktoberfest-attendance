"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { type StorySlideOf, useStoryCopy, type WrappedData } from "@prostcounter/shared/wrapped";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Reveal } from "../Reveal";
import { StoryBig, StoryHeading } from "../StoryText";

interface ProstSlideProps {
  slide: StorySlideOf<"prost">;
  animate: boolean;
  data: WrappedData;
  onReplay: () => void;
  onClose: () => void;
}

export function ProstSlide({ slide, animate, data, onReplay, onClose }: ProstSlideProps) {
  const { t } = useTranslation();
  const copy = useStoryCopy();
  const router = useRouter();

  const handleShare = useCallback(() => {
    localStorage.setItem("wrapped-share-data-v2", JSON.stringify(data));
    router.push("/wrapped/share");
  }, [data, router]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate} kind="stamp">
        <StoryBig className="text-7xl">{copy(slide.title)}</StoryBig>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryHeading className="text-2xl">{copy(slide.summary)}</StoryHeading>
      </Reveal>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleShare}
          className="pointer-events-auto rounded-xl bg-wrapped-ink px-6 py-4 text-base font-bold text-wrapped-paper"
        >
          {t("wrapped.outro.share")}
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="pointer-events-auto rounded-xl border-2 border-wrapped-ink px-6 py-3 text-base font-bold text-wrapped-ink"
        >
          {t("wrapped.story.prost.replay")}
        </button>
        <button type="button" onClick={onClose} className="pointer-events-auto px-6 py-2 text-sm text-wrapped-ink/70">
          {t("wrapped.close")}
        </button>
      </div>
    </div>
  );
}
