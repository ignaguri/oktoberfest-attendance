"use client";

import { useTrack } from "@prostcounter/shared/analytics/react";
import { usePersonaCollection } from "@prostcounter/shared/hooks";
import { buildPersonaCollection } from "@prostcounter/shared/wrapped";
import { ChevronRight, Layers } from "lucide-react";
import { Link } from "next-view-transitions";

import { useTranslation } from "@/lib/i18n/client";

/** Row linking to the persona collection, from the Wrapped archive or Profile. */
export function PersonaCollectionEntry({ source }: { source: "archive" | "profile" }) {
  const { t } = useTranslation();
  const track = useTrack();
  const { data } = usePersonaCollection();
  const collection = data ? buildPersonaCollection(data.earned) : null;
  const label = collection
    ? t("wrapped.personas.entry", { collected: collection.collectedCount, total: collection.total })
    : t("wrapped.personas.entryNoCount");

  return (
    <Link
      href="/wrapped/personas"
      onClick={() => track("persona_collection_opened", { source })}
      className="flex items-center justify-between px-6 py-4 hover:opacity-80"
    >
      <span className="flex items-center gap-3">
        <Layers className="size-5 text-yellow-600" />
        <span className="font-semibold">{label}</span>
      </span>
      <ChevronRight className="size-5 text-gray-400" />
    </Link>
  );
}
