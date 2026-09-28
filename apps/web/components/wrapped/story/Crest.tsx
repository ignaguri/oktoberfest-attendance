"use client";

import { PERSONA_CREST_FILES, type PersonaId } from "@prostcounter/shared/wrapped";
import Image from "next/image";
import { useState } from "react";

/** The persona's crest PNG, or a plain stamped shield when it is missing. */
export function Crest({ personaId }: { personaId: PersonaId }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <Image
        src={`/wrapped/crests/${PERSONA_CREST_FILES[personaId]}.png`}
        alt=""
        width={160}
        height={160}
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <svg width={140} height={160} viewBox="0 0 132 150" aria-hidden="true">
      <path
        d="M66 4 L124 22 V74 C124 110 98 134 66 146 C34 134 8 110 8 74 V22 Z"
        fill="#FFFFFF"
        stroke="#16325C"
        strokeWidth={4}
      />
      <path d="M66 18 L112 32 V74 C112 102 92 122 66 132 C40 122 20 102 20 74 V32 Z" fill="#3A7AC4" fillOpacity={0.14} />
      <path d="M40 74 H92" stroke="#F59E0B" strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}
