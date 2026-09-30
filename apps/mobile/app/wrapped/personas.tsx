import { useOpenPersonaCard, usePersonaCollection } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ScrollView } from "react-native";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";
import { PersonaAlbum } from "@/components/wrapped/personas/persona-album";

export default function PersonaCollectionScreen() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = usePersonaCollection();
  const { mutate: openCard } = useOpenPersonaCard();

  return (
    <ScrollView className="flex-1 bg-wrapped-paper">
      {loading && !data ? (
        <VStack space="md" className="items-center p-4">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-80 w-60 rounded-xl" />
        </VStack>
      ) : null}
      {error && !data ? (
        <ErrorState error={error} title={t("wrapped.personas.loadError")} onRetry={() => refetch()} />
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
    </ScrollView>
  );
}
