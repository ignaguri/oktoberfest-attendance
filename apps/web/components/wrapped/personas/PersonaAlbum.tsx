"use client";

import type { EarnedPersona } from "@prostcounter/shared";
import { useTranslation } from "@prostcounter/shared/i18n";
import { buildPersonaCollection, type PersonaId } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Crest } from "../story/Crest";
import { PersonaCard } from "./PersonaCard";

interface PersonaAlbumProps {
  earned: EarnedPersona[];
  onOpen: (personaId: PersonaId) => void;
}

/** Header with progress, one featured card as large as the viewport allows, and a strip of all ten. */
export function PersonaAlbum({ earned, onOpen }: PersonaAlbumProps) {
  const { t } = useTranslation();
  const collection = useMemo(() => buildPersonaCollection(earned), [earned]);
  const [index, setIndex] = useState(collection.initialIndex);
  const last = collection.cards.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setIndex((value) => Math.min(value + 1, last));
      } else if (event.key === "ArrowLeft") {
        setIndex((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [last]);

  const featured = collection.cards[index];
  const progress = (collection.collectedCount / collection.total) * 100;

  return (
    <div className="flex flex-col gap-5 text-wrapped-ink">
      <div>
        <h1 className="font-wrapped text-2xl font-extrabold">{t("wrapped.personas.title")}</h1>
        <p className="text-sm font-semibold opacity-75">
          {t("wrapped.personas.progress", {
            collected: collection.collectedCount,
            total: collection.total,
          })}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F0E4C8]">
          <div className="h-full bg-wrapped-amber" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(value - 1, 0))}
          disabled={index === 0}
          aria-label={t("wrapped.personas.previous")}
          className="hidden rounded-full p-2 disabled:opacity-30 sm:block"
        >
          <ChevronLeft className="size-6" />
        </button>
        {/* As wide as the column allows, but no taller than about two thirds of the viewport */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-[min(100%,calc(min(64dvh,560px)*5/7))]">
            <PersonaCard
              key={featured.personaId}
              card={featured}
              total={collection.total}
              onOpen={onOpen}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIndex((value) => Math.min(value + 1, last))}
          disabled={index === last}
          aria-label={t("wrapped.personas.next")}
          className="hidden rounded-full p-2 disabled:opacity-30 sm:block"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      <div className="-mx-2 flex gap-2 overflow-x-auto px-2 py-1">
        {collection.cards.map((card, cardIndex) => (
          <button
            key={card.personaId}
            type="button"
            onClick={() => setIndex(cardIndex)}
            aria-label={t("wrapped.personas.number", { number: card.number })}
            title={t("wrapped.personas.a11y.thumbnailHint")}
            className={cn(
              "flex aspect-[5/7] w-11 shrink-0 items-center justify-center rounded border-2 border-wrapped-ink bg-wrapped-paper",
              card.state === "locked" && "border-dashed",
              card.state === "unopened" && "bg-wrapped-ink",
              cardIndex === index && "outline outline-2 outline-offset-2 outline-wrapped-amber",
            )}
          >
            {card.state === "unopened" ? null : (
              <Crest personaId={card.personaId} size="xs" silhouette={card.state === "locked"} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
