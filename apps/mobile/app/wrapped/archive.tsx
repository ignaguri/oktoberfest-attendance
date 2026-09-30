import { useWrappedFestivals } from "@prostcounter/shared/hooks";
import { ScrollView } from "react-native";

import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";
import { PersonaCollectionEntry } from "@/components/wrapped/personas/persona-collection-entry";
import { WrappedFestivalList } from "@/components/wrapped/wrapped-festival-list";

export default function WrappedArchiveScreen() {
  const { data: festivals } = useWrappedFestivals();

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <Card size="md" variant="elevated">
          <PersonaCollectionEntry source="archive" />
        </Card>
        <Card size="md" variant="elevated">
          <WrappedFestivalList festivals={festivals ?? []} />
        </Card>
      </VStack>
    </ScrollView>
  );
}
