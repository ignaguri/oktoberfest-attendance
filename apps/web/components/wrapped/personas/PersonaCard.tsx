"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { PERSONA_NAMES, type PersonaCardEntry, type PersonaId } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useState } from "react";

import { Crest } from "../story/Crest";

interface PersonaCardProps {
  card: PersonaCardEntry;
  total: number;
  onOpen: (personaId: PersonaId) => void;
}

const FACE =
  "absolute inset-0 flex flex-col overflow-hidden rounded-2xl border-[3px] border-wrapped-ink p-4 text-wrapped-ink";
const SHADOW = "absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl";
/** An ink shadow disappears into a navy face, so dark faces cast amber */
const PAPER_SHADOW = cn(SHADOW, "bg-wrapped-ink");
const INK_SHADOW = cn(SHADOW, "bg-wrapped-amber");
/** The story's rhombus paper as a diamond tile, which reads at card size where the gradient pattern turns to zigzags */
const PAPER_PATTERN = "bg-wrapped-paper bg-[url(/wrapped/rhombus-tile.png)] bg-[length:28px_28px]";
/** A side of the card with its own shadow, so the shadow turns with it */
const SIDE = "absolute inset-0 [backface-visibility:hidden]";
const FLIP_TRANSITION = { duration: 0.6, ease: [0.65, 0, 0.35, 1] as const };
/** How much the card lifts toward the viewer at the middle of a flip */
const FLIP_LIFT = 1.08;

/**
 * One persona card, 5:7. Locked: silhouette + hint, not interactive.
 * Unopened: face-down with a NEW ribbon; tapping flips it face-up and calls
 * onOpen when the flip lands. Opened: tapping flips between front and back.
 */
export function PersonaCard({ card, total, onOpen }: PersonaCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const [turned, setTurned] = useState(false);
  // A card revealed here lands on its front at 180°; keep that side the front
  // after the cache marks it opened, or it would jump to the back.
  const [revealedHere, setRevealedHere] = useState(false);
  const [previousState, setPreviousState] = useState(card.state);
  if (card.state !== previousState) {
    setPreviousState(card.state);
    // The open failed and the cache rolled back: deal the card face-down again
    if (previousState === "opened" && card.state === "unopened") {
      setTurned(false);
      setRevealedHere(false);
    }
  }
  const name = PERSONA_NAMES[card.personaId];
  const hint = t(`wrapped.story.persona.${card.personaId}.hint`);

  if (card.state === "locked") {
    return (
      <div
        role="img"
        aria-label={t("wrapped.personas.a11y.locked", { number: card.number, hint })}
        className="relative aspect-[5/7] w-full"
      >
        <div className={cn(FACE, "items-center border-dashed bg-wrapped-paper")}>
          <span className="self-start text-sm font-bold opacity-60">
            {t("wrapped.personas.number", { number: card.number })}
          </span>
          {/* Smaller than an earned crest so the hint fits, even on two lines */}
          <div className="flex min-h-0 flex-1 items-center justify-center self-stretch">
            <div className="w-[68%]">
              <Crest personaId={card.personaId} fluid silhouette />
            </div>
          </div>
          <span className="rounded-md border-2 border-dashed border-wrapped-ink/60 px-4 py-1 font-wrapped text-xl font-bold opacity-60">
            {t("wrapped.personas.lockedName")}
          </span>
          <div className="mt-4 text-center">
            <p className="text-xs font-extrabold uppercase tracking-wider opacity-60">
              {t("wrapped.personas.howToEarn")}
            </p>
            <p className="text-base font-bold">{hint}</p>
          </div>
        </div>
      </div>
    );
  }

  const front: ReactNode = (
    <>
      <span className={PAPER_SHADOW} aria-hidden="true" />
      <div className={cn(FACE, PAPER_PATTERN, "items-center")}>
        <span className="self-start text-sm font-bold">
          {t("wrapped.personas.number", { number: card.number })}
        </span>
        <div className="flex min-h-0 flex-1 items-center justify-center self-stretch">
          <div className="w-[85%]">
            <Crest personaId={card.personaId} fluid />
          </div>
        </div>
        <span className="-rotate-2 rounded-md bg-wrapped-ink px-5 py-1.5 font-wrapped text-2xl font-extrabold text-wrapped-paper">
          {name}
        </span>
        <span className="mt-4 text-sm font-semibold text-wrapped-blue">
          {card.festivals[0]?.name}
        </span>
      </div>
    </>
  );

  const back: ReactNode = (
    <>
      <span className={INK_SHADOW} aria-hidden="true" />
      <div className={cn(FACE, "gap-3 bg-wrapped-ink p-5 text-left text-wrapped-paper")}>
        <p className="font-wrapped text-3xl font-extrabold">{name}</p>
        <p className="font-wrapped text-lg italic opacity-90">
          {t(`wrapped.story.persona.${card.personaId}.description`)}
        </p>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-wrapped-amber">
          {t("wrapped.personas.howToEarn")}
        </p>
        <p className="text-base font-semibold">{hint}</p>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-wrapped-amber">
          {t("wrapped.personas.collectedAt")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {card.festivals.map((festival) => (
            <span
              key={festival.festivalId}
              className="rounded-full bg-wrapped-paper/15 px-3 py-1 text-sm font-semibold"
            >
              {festival.name}
            </span>
          ))}
        </div>
        <p className="mt-auto text-center text-sm font-bold opacity-60">
          {t("wrapped.personas.numberOfTotal", { number: card.number, total })}
        </p>
      </div>
    </>
  );

  const faceDown: ReactNode = (
    <>
      <span className={INK_SHADOW} aria-hidden="true" />
      <div className={cn(FACE, "items-center justify-center bg-wrapped-ink")}>
        <span className="absolute right-3 top-4 rotate-6 rounded-sm bg-wrapped-amber px-2.5 py-1 text-sm font-black uppercase tracking-wider text-wrapped-ink">
          {t("wrapped.personas.new")}
        </span>
        <span className="flex size-24 items-center justify-center rounded-full border-4 border-wrapped-paper bg-wrapped-amber text-5xl font-black text-wrapped-ink">
          ?
        </span>
        <span className="absolute bottom-5 text-base font-bold text-wrapped-paper">
          {t("wrapped.personas.tapToOpen")}
        </span>
      </div>
    </>
  );

  const isUnopened = card.state === "unopened";
  let zeroFace = front;
  let halfFace = back;
  if (isUnopened) {
    zeroFace = faceDown;
    halfFace = front;
  } else if (revealedHere) {
    zeroFace = back;
    halfFace = front;
  }

  const onPress = () => {
    if (isUnopened) {
      if (turned) {
        return;
      }
      setTurned(true);
      setRevealedHere(true);
      if (reduceMotion) {
        onOpen(card.personaId);
      }
      return;
    }
    setTurned((value) => !value);
  };

  const onFlipLanded = () => {
    if (isUnopened && turned && !reduceMotion) {
      onOpen(card.personaId);
    }
  };

  const label = isUnopened
    ? t("wrapped.personas.a11y.unopened", { number: card.number })
    : t("wrapped.personas.a11y.opened", { number: card.number, name });

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      title={isUnopened ? t("wrapped.personas.a11y.openHint") : t("wrapped.personas.a11y.flipHint")}
      className="relative block aspect-[5/7] w-full [perspective:1000px]"
    >
      {reduceMotion ? (
        <div className="relative size-full">{turned ? halfFace : zeroFace}</div>
      ) : (
        <motion.div
          className="relative size-full [transform-style:preserve-3d]"
          initial={false}
          animate={{ rotateY: turned ? 180 : 0, scale: [1, FLIP_LIFT, 1] }}
          transition={FLIP_TRANSITION}
          onAnimationComplete={onFlipLanded}
        >
          <div className={SIDE}>{zeroFace}</div>
          {/* Ends at 360°, unmirrored, so its shadow sits the same way */}
          <div className={cn(SIDE, "[transform:rotateY(180deg)]")}>{halfFace}</div>
        </motion.div>
      )}
    </button>
  );
}
