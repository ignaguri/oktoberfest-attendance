import { useWrappedFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getWrappedArchiveSummary } from "@prostcounter/shared/utils";
import { useRouter } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { IconColors } from "@/lib/constants/colors";

/** One row for every Wrapped, however many festivals: the list lives on /wrapped/archive */
export function WrappedArchiveSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: festivals } = useWrappedFestivals();
  const summary = getWrappedArchiveSummary(festivals);

  if (!summary) {
    return null;
  }

  const { target } = summary;
  const label = t("profile.wrappedArchive.row", { count: summary.count });

  return (
    <Card size="md" variant="elevated">
      <Pressable
        className="flex-row items-center justify-between"
        onPress={() =>
          target.kind === "festival"
            ? router.push({ pathname: "/wrapped", params: { festivalId: target.festivalId } })
            : router.push("/wrapped/archive")
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          target.kind === "festival"
            ? t("profile.wrappedArchive.openHint")
            : t("profile.wrappedArchive.listHint")
        }
      >
        <View className="flex-row items-center gap-3">
          <Sparkles size={20} color={IconColors.default} />
          <Text className="font-semibold text-typography-900">{label}</Text>
          {summary.newCount > 0 ? (
            <View className="rounded-full bg-primary-500 px-2 py-0.5">
              <Text className="text-xs font-semibold text-white">
                {t("profile.wrappedArchive.newCount", { count: summary.newCount })}
              </Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={20} color={IconColors.muted} />
      </Pressable>
    </Card>
  );
}
