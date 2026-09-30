"use client";

import { useOpenPersonaCard, usePersonaCollection } from "@prostcounter/shared/hooks";

import { Card, CardContent } from "@/components/ui/card";
import { PersonaAlbum } from "@/components/wrapped/personas/PersonaAlbum";
import { useTranslation } from "@/lib/i18n/client";

export default function PersonaCollectionPage() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = usePersonaCollection();
  const { mutate: openCard } = useOpenPersonaCard();

  return (
    <Card className="mx-auto mt-6 w-full max-w-lg bg-wrapped-paper">
      <CardContent className="pt-6">
        {loading && !data ? <p className="text-center text-sm opacity-70">{t("wrapped.loading")}</p> : null}
        {error && !data ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm">{t("wrapped.personas.loadError")}</p>
            <button type="button" onClick={() => refetch()} className="rounded-lg border px-4 py-2 text-sm font-semibold">
              {t("common.buttons.retry")}
            </button>
          </div>
        ) : null}
        {data ? (
          <PersonaAlbum
            earned={data.earned}
            onOpen={(personaId) => {
              openCard(personaId).catch(() => {
                // Rolled back in the cache by useOpenPersonaCard; the card turns face-down again
              });
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
