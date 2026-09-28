import { useFestival } from "@prostcounter/shared/contexts";
import { useWrapped, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatLocalized } from "@prostcounter/shared/utils";
import { resolveWrappedFestivalId } from "@prostcounter/shared/wrapped";
import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { WrappedPager } from "@/components/wrapped/wrapped-pager";
import { WrappedStateScreen } from "@/components/wrapped/wrapped-state-screen";
import { Colors, IconColors } from "@/lib/constants/colors";

export default function WrappedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { festivalId: festivalIdParam } = useLocalSearchParams<{ festivalId?: string }>();
  const { currentFestival } = useFestival();
  const {
    data: festivals,
    loading: festivalsLoading,
    error: festivalsError,
  } = useWrappedFestivals();
  const festivalId = resolveWrappedFestivalId(festivalIdParam, festivals, currentFestival?.id);
  const { data: result, loading: wrappedLoading, error } = useWrapped(festivalId);
  const loading = festivalsLoading || wrappedLoading;

  const handleClose = () => {
    router.back();
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-yellow-50">
        <VStack space="md" className="items-center">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-base text-gray-600">{t("wrapped.loading")}</Text>
        </VStack>
      </View>
    );
  }

  if (festivalsError) {
    return <WrappedStateScreen title={t("wrapped.error")} onClose={handleClose} />;
  }

  // No link, no unlocked Wrapped and no current festival: nothing to open
  if (!festivalId) {
    return (
      <WrappedStateScreen
        title={t("wrapped.notAttended.title")}
        description={t("wrapped.notAttended.description")}
        onClose={handleClose}
      />
    );
  }

  if (error || !result) {
    return <WrappedStateScreen title={t("wrapped.error")} onClose={handleClose} />;
  }

  if (result.status === "locked") {
    // Device timezone is right: it is the same instant as 00:00 at the festival
    const unlocksAt = new Date(result.unlocksAt);
    return (
      <WrappedStateScreen
        title={t("wrapped.locked.title")}
        description={t("wrapped.locked.description", {
          date: formatLocalized(unlocksAt, "PPP"),
          time: formatLocalized(unlocksAt, "p"),
        })}
        onClose={handleClose}
      />
    );
  }

  if (result.status === "not_attended") {
    return (
      <WrappedStateScreen
        title={t("wrapped.notAttended.title")}
        description={t("wrapped.notAttended.description")}
        onClose={handleClose}
      />
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Close button */}
      <Pressable
        onPress={handleClose}
        className="absolute right-4 z-50 rounded-full bg-black/30 p-2"
        style={{ top: insets.top + 8 }}
        accessibilityLabel={t("wrapped.close")}
        accessibilityRole="button"
      >
        <X size={24} color={IconColors.white} />
      </Pressable>

      {/* Wrapped content */}
      <WrappedPager data={result.wrapped} onClose={handleClose} />
    </View>
  );
}
