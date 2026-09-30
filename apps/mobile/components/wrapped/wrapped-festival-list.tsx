import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedFestival } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export function WrappedFestivalList({ festivals }: { festivals: WrappedFestival[] }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <VStack>
      {festivals.map((festival, index) => (
        <Pressable
          key={festival.festivalId}
          className={cn(
            "flex-row items-center justify-between py-3",
            index < festivals.length - 1 && "border-b border-outline-100",
          )}
          onPress={() =>
            router.push({ pathname: "/wrapped", params: { festivalId: festival.festivalId } })
          }
          accessibilityRole="button"
          accessibilityLabel={festival.name}
          accessibilityHint={t("profile.wrappedArchive.openHint")}
        >
          <View className="flex-row items-center gap-3">
            <Sparkles size={20} color={IconColors.default} />
            <Text className="text-typography-900">{festival.name}</Text>
            {!festival.viewed ? (
              <View className="rounded-full bg-primary-500 px-2 py-0.5">
                <Text className="text-xs font-semibold text-white">
                  {t("profile.wrappedArchive.new")}
                </Text>
              </View>
            ) : null}
          </View>
          <ChevronRight size={20} color={IconColors.muted} />
        </Pressable>
      ))}
    </VStack>
  );
}
