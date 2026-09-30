import { Motion } from "@legendapp/motion";
import { useFestival } from "@prostcounter/shared/contexts";
import { useHighlights, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getWrappedHomeState } from "@prostcounter/shared/utils";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Pressable } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/** Countdown over the festival's last days, then the way into the Wrapped until it's viewed */
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
  const heading =
    state.kind === "ready"
      ? t("wrapped.cta.ready")
      : t("wrapped.cta.countdown", { count: state.daysUntilUnlock });
  const teaser = !highlights
    ? null
    : highlights.totalDays === 0
      ? t("wrapped.cta.teaserEmpty")
      : t("wrapped.cta.teaser", {
          beers: t("wrapped.story.units.beers", { count: highlights.totalBeers }),
          days: t("wrapped.cta.days", { count: highlights.totalDays }),
        });

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

          <Text className="text-center text-lg font-bold text-gray-800">{heading}</Text>

          {state.kind === "ready" ? (
            <>
              <Text className="text-center text-sm text-gray-600">
                {t("wrapped.cta.readyDescription", { festivalName })}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/wrapped", params: { festivalId: currentFestival.id } })
                }
                className="mt-1 rounded-lg bg-yellow-500 px-6 py-3"
                accessibilityLabel={t("wrapped.cta.viewButton")}
                accessibilityHint={t("profile.wrappedArchive.openHint")}
                accessibilityRole="button"
              >
                <Text className="font-semibold text-white">{t("wrapped.cta.viewButton")}</Text>
              </Pressable>
            </>
          ) : (
            teaser && <Text className="text-center text-sm text-gray-600">{teaser}</Text>
          )}
        </VStack>
      </Card>
    </Motion.View>
  );
}
