import { Motion } from "@legendapp/motion";
import { useFestival } from "@prostcounter/shared/contexts";
import { useHighlights, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { Trans, useTranslation } from "@prostcounter/shared/i18n";
import { getWrappedHomeState } from "@prostcounter/shared/utils";
import { useRouter } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { Pressable } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/** Countdown over the festival's last days, the way into the Wrapped, then a compact pointer to the Profile */
export function WrappedCTA() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival } = useFestival();
  const { data: festivals, loading } = useWrappedFestivals();
  const { data: highlights } = useHighlights(currentFestival?.id);

  if (loading || !currentFestival) {
    return null;
  }

  const state = getWrappedHomeState(currentFestival, new Date(), festivals ?? undefined);
  if (!state) {
    return null;
  }

  const festivalName = currentFestival.name;
  const teaser = !highlights
    ? null
    : highlights.totalDays === 0
      ? t("wrapped.cta.teaserEmpty")
      : t("wrapped.cta.teaser", {
          beers: t("wrapped.story.units.beers", { count: highlights.totalBeers }),
          days: t("wrapped.cta.days", { count: highlights.totalDays }),
        });

  if (state.kind === "countdown") {
    return (
      <Motion.View
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "timing", duration: 500 }}
      >
        <Card size="md" className="border border-yellow-300 bg-yellow-50 p-3">
          <HStack space="md" className="items-center">
            <Sparkles size={20} color={IconColors.default} />
            <VStack className="flex-1">
              <Text className="text-base font-semibold text-gray-800">
                <Trans
                  t={t}
                  i18nKey="wrapped.cta.countdown"
                  count={state.daysUntilUnlock}
                  components={{ when: <Text className="font-bold text-yellow-700" /> }}
                />
              </Text>
              {teaser && <Text className="text-sm text-gray-600">{teaser}</Text>}
            </VStack>
          </HStack>
        </Card>
      </Motion.View>
    );
  }

  const openWrapped = () =>
    router.push({ pathname: "/wrapped", params: { festivalId: currentFestival.id } });

  if (state.kind === "viewed") {
    return (
      <Pressable
        onPress={() => router.navigate("/(tabs)/profile")}
        accessibilityLabel={t("wrapped.cta.relive", { festivalName })}
        accessibilityHint={t("wrapped.cta.reliveHint")}
        accessibilityRole="button"
      >
        <Card size="md" className="border border-yellow-300 bg-yellow-50 p-3">
          <HStack space="md" className="items-center">
            <Sparkles size={20} color={IconColors.default} />
            <VStack className="flex-1">
              <Text className="text-base font-semibold text-gray-800">
                {t("wrapped.cta.relive", { festivalName })}
              </Text>
              <Text className="text-sm text-gray-600">{t("wrapped.cta.reliveDescription")}</Text>
            </VStack>
            <ChevronRight size={20} color={IconColors.muted} />
          </HStack>
        </Card>
      </Pressable>
    );
  }

  return (
    <Motion.View
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "timing", duration: 500 }}
    >
      <Card
        size="lg"
        variant="elevated"
        className="overflow-hidden border-2 border-yellow-400 bg-yellow-50 p-4"
      >
        <VStack space="md" className="items-center">
          <Sparkles size={28} color={IconColors.default} />

          <Text className="text-center text-lg font-bold text-gray-800">
            {t("wrapped.cta.ready")}
          </Text>

          <Text className="text-center text-sm text-gray-600">
            {t("wrapped.cta.readyDescription", { festivalName })}
          </Text>
          <Pressable
            onPress={openWrapped}
            className="mt-1 rounded-lg bg-yellow-500 px-6 py-3"
            accessibilityLabel={t("wrapped.cta.viewButton")}
            accessibilityHint={t("profile.wrappedArchive.openHint")}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-white">{t("wrapped.cta.viewButton")}</Text>
          </Pressable>
        </VStack>
      </Card>
    </Motion.View>
  );
}
