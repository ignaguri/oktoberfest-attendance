"use client";

import { PERSONA_CREST_FILES, type PersonaId } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import Image from "next/image";
import { useState } from "react";

/** lg is the persona reveal, md a collection card, sm the Prost recap card, xs a collection thumbnail. */
const CREST_PX = { lg: 288, md: 160, sm: 64, xs: 36 } as const;
/** The crest PNGs' own size, requested when the crest is fluid */
const CREST_SOURCE_PX = 512;

/** The persona's crest PNG, or a plain stamped shield when it is missing. */
export function Crest({
  personaId,
  size = "lg",
  silhouette = false,
  fluid = false,
}: {
  personaId: PersonaId;
  size?: keyof typeof CREST_PX;
  /** A locked collection card: the shield's outline in faint ink */
  silhouette?: boolean;
  /** Fill the parent's width instead of a fixed size, for a crest that scales with its card */
  fluid?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <Image
        src={`/wrapped/crests/${PERSONA_CREST_FILES[personaId]}.png`}
        alt=""
        width={fluid ? CREST_SOURCE_PX : CREST_PX[size]}
        height={fluid ? CREST_SOURCE_PX : CREST_PX[size]}
        sizes={fluid ? "(max-width: 640px) 80vw, 360px" : undefined}
        aria-hidden="true"
        className={cn(fluid && "h-auto w-full", silhouette && "opacity-20 brightness-0")}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <svg
      width={fluid ? "100%" : (CREST_PX[size] * 7) / 8}
      height={fluid ? undefined : CREST_PX[size]}
      viewBox="0 0 132 150"
      aria-hidden="true"
      className={cn(silhouette && "opacity-20")}
    >
      <path
        d="M66 4 L124 22 V74 C124 110 98 134 66 146 C34 134 8 110 8 74 V22 Z"
        fill="#FFFFFF"
        stroke="#16325C"
        strokeWidth={4}
      />
      <path
        d="M66 18 L112 32 V74 C112 102 92 122 66 132 C40 122 20 102 20 74 V32 Z"
        fill="#3A7AC4"
        fillOpacity={0.14}
      />
      <path d="M40 74 H92" stroke="#F59E0B" strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}
