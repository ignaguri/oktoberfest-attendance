import { useTrack } from "@prostcounter/shared/analytics/react";
import { usePersonaCollection } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { buildPersonaCollection } from "@prostcounter/shared/wrapped";
import { useRouter } from "expo-router";
import { ChevronRight, Layers } from "lucide-react-native";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { IconColors } from "@/lib/constants/colors";

/** Row linking to the persona collection, from the Wrapped archive or Profile. */
export function PersonaCollectionEntry({ source }: { source: "archive" | "profile" }) {
  const { t } = useTranslation();
  const router = useRouter();
  const track = useTrack();
  const { data } = usePersonaCollection();
  const collection = data ? buildPersonaCollection(data.earned) : null;
  const label = collection
    ? t("wrapped.personas.entry", { collected: collection.collectedCount, total: collection.total })
    : t("wrapped.personas.entryNoCount");

  return (
    <Pressable
      className="flex-row items-center justify-between"
      onPress={() => {
        track("persona_collection_opened", { source });
        router.push("/wrapped/personas");
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("wrapped.personas.entryHint")}
    >
      <View className="flex-row items-center gap-3">
        <Layers size={20} color={IconColors.default} />
        <Text className="font-semibold text-typography-900">{label}</Text>
      </View>
      <ChevronRight size={20} color={IconColors.muted} />
    </Pressable>
  );
}
