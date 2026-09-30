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
  "absolute inset-0 flex flex-col rounded-xl border-[3px] border-wrapped-ink p-3 text-wrapped-ink [backface-visibility:hidden]";
const HATCH_PAPER = "bg-[repeating-linear-gradient(45deg,#FFF8EA_0_8px,#F3EAD6_8px_16px)]";
const HATCH_INK = "bg-[repeating-linear-gradient(45deg,#1F3F70_0_8px,#16325C_8px_16px)]";

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
        <div className={cn(FACE, HATCH_PAPER, "items-center border-dashed")}>
          <span className="self-start text-xs font-bold">{t("wrapped.personas.number", { number: card.number })}</span>
          <div className="my-2">
            <Crest personaId={card.personaId} size="md" silhouette />
          </div>
          <span className="rounded border border-dashed border-wrapped-ink px-3 py-1 text-sm font-bold">
            {t("wrapped.personas.lockedName")}
          </span>
          <div className="mt-auto text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-60">{t("wrapped.personas.howToEarn")}</p>
            <p className="text-sm font-bold">{hint}</p>
          </div>
        </div>
      </div>
    );
  }

  const front: ReactNode = (
    <div className={cn(FACE, "items-center bg-wrapped-paper")}>
      <span className="self-start text-xs font-bold">{t("wrapped.personas.number", { number: card.number })}</span>
      <div className="my-2">
        <Crest personaId={card.personaId} size="md" />
      </div>
      <span className="rounded bg-wrapped-ink px-3 py-1 text-sm font-bold text-wrapped-paper">{name}</span>
      <span className="mt-auto text-xs font-semibold text-wrapped-blue">{card.festivals[0]?.name}</span>
    </div>
  );

  const back: ReactNode = (
    <div className={cn(FACE, "gap-2 bg-wrapped-ink text-wrapped-paper")}>
      <p className="font-wrapped text-lg font-extrabold">{name}</p>
      <p className="font-wrapped text-sm italic opacity-90">{t(`wrapped.story.persona.${card.personaId}.description`)}</p>
      <hr className="border-dashed border-wrapped-paper/30" />
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-wrapped-amber">{t("wrapped.personas.howToEarn")}</p>
      <p className="text-sm font-semibold">{hint}</p>
      <hr className="border-dashed border-wrapped-paper/30" />
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-wrapped-amber">{t("wrapped.personas.collectedAt")}</p>
      <div className="flex flex-wrap gap-1">
        {card.festivals.map((festival) => (
          <span key={festival.festivalId} className="rounded-full bg-wrapped-paper/15 px-2 py-0.5 text-xs font-semibold">
            {festival.name}
          </span>
        ))}
      </div>
      <p className="mt-auto text-center text-xs font-bold opacity-60">
        {t("wrapped.personas.numberOfTotal", { number: card.number, total })}
      </p>
    </div>
  );

  const faceDown: ReactNode = (
    <div className={cn(FACE, HATCH_INK, "items-center justify-center")}>
      <span className="absolute -right-2 top-3 rotate-6 rounded-sm bg-wrapped-amber px-2 py-0.5 text-xs font-black uppercase tracking-wider text-wrapped-ink">
        {t("wrapped.personas.new")}
      </span>
      <span className="flex size-14 items-center justify-center rounded-full border-[3px] border-wrapped-paper bg-wrapped-amber text-2xl font-black text-wrapped-ink">
        ?
      </span>
      <span className="absolute bottom-3 text-xs font-bold text-wrapped-paper">{t("wrapped.personas.tapToOpen")}</span>
    </div>
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
      className="relative block aspect-[5/7] w-full [perspective:1200px]"
    >
      <span className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl bg-wrapped-ink" aria-hidden="true" />
      {reduceMotion ? (
        <div className="relative size-full">{turned ? halfFace : zeroFace}</div>
      ) : (
        <motion.div
          className="relative size-full [transform-style:preserve-3d]"
          animate={{ rotateY: turned ? 180 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onAnimationComplete={onFlipLanded}
        >
          {zeroFace}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{halfFace}</div>
        </motion.div>
      )}
    </button>
  );
}
