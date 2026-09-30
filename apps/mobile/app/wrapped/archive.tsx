import { useWrappedFestivals } from "@prostcounter/shared/hooks";
import { ScrollView } from "react-native";

import { Card } from "@/components/ui/card";
import { WrappedFestivalList } from "@/components/wrapped/wrapped-festival-list";

export default function WrappedArchiveScreen() {
  const { data: festivals } = useWrappedFestivals();

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <Card size="md" variant="elevated">
        <WrappedFestivalList festivals={festivals ?? []} />
      </Card>
    </ScrollView>
  );
}
