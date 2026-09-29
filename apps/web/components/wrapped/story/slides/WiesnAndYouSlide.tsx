"use client";

import {
  REVEAL_STEP_MS,
  type StatCard,
  type StorySlideOf,
  useCountUp,
  useStoryCopy,
  useStoryLanguage,
} from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryKicker, StoryNote } from "../StoryText";

/** Big cards: the crowd and your share. Navy, amber figures, tilted like the compare cards. */
const BIG_TILTS = ["-rotate-2", "rotate-2"];
/** Small cards: the fun facts. Amber, leaning the other way. */
const SMALL_TILTS = ["rotate-3", "-rotate-3"];
const FIND_TILTS = ["-rotate-3", "rotate-2", "-rotate-1"];

export function WiesnAndYouSlide({ slide, animate }: { slide: StorySlideOf<"wiesnAndYou">; animate: boolean }) {
  const copy = useStoryCopy();
  const language = useStoryLanguage();
  const bigCards = [slide.visitors, slide.share].filter((card): card is StatCard => card !== null);
  const smallCards = [slide.mugs, slide.lostAndFound].filter((card): card is StatCard => card !== null);
  // Steps follow what is shown: kicker, each big card, the small row, the finds.
  const smallStep = 1 + bigCards.length;
  const findsStep = smallStep + (smallCards.length > 0 ? 1 : 0);
  // The mugs count up once their card is in, as they did on their own slide.
  const mugs = useCountUp(Number(slide.mugs?.stat.params?.mugs ?? 0), animate, 1200, smallStep * REVEAL_STEP_MS);
  const statOf = (card: StatCard) =>
    card === slide.mugs ? copy({ ...card.stat, params: { mugs: Math.round(mugs) } }) : copy(card.stat);
  return (
    <div className="relative flex flex-1 flex-col justify-center gap-6 pb-16 text-center">
      <Reveal step={0} animate={animate}>
        <StoryKicker className="text-sm">{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      {bigCards.map((card, index) => (
        <Reveal key={card.caption.key} step={index + 1} animate={animate}>
          <div className={cn("mx-4 rounded-2xl bg-wrapped-ink px-5 py-4", BIG_TILTS[index % BIG_TILTS.length])}>
            <StoryBig className="text-4xl text-wrapped-amber">{copy(card.stat)}</StoryBig>
            <StoryBody className="mt-1 text-base leading-snug text-wrapped-paper">{copy(card.caption)}</StoryBody>
          </div>
        </Reveal>
      ))}
      {smallCards.length > 0 ? (
        <Reveal step={smallStep} animate={animate}>
          <div className="flex gap-3 px-2">
            {smallCards.map((card, index) => (
              <div
                key={card.caption.key}
                className={cn("flex-1 rounded-xl bg-wrapped-amber px-3 py-3", SMALL_TILTS[index % SMALL_TILTS.length])}
              >
                <StoryBig className="text-3xl">{statOf(card)}</StoryBig>
                <StoryBody className="text-sm leading-snug">{copy(card.caption)}</StoryBody>
              </div>
            ))}
          </div>
        </Reveal>
      ) : null}
      {slide.finds.length > 0 ? (
        <Reveal step={findsStep} animate={animate}>
          <StoryKicker className="mb-2">{copy(slide.findsLabel)}</StoryKicker>
          <div className="flex flex-wrap justify-center gap-2">
            {slide.finds.map((find, index) => (
              <span
                key={`${index}-${find.en}`}
                className={cn(
                  "rounded-md border-2 border-wrapped-ink bg-white px-3 py-1.5 text-sm font-bold text-wrapped-ink",
                  FIND_TILTS[index % FIND_TILTS.length],
                )}
              >
                {find[language] ?? find.en}
              </span>
            ))}
          </div>
        </Reveal>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1">
        {slide.checkBack ? <StoryNote className="text-wrapped-ink">{copy(slide.checkBack)}</StoryNote> : null}
        <StoryNote>{copy(slide.source)}</StoryNote>
      </div>
    </div>
  );
}
