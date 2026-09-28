import { useFestival } from "@prostcounter/shared/contexts";
import { useWrapped, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatLocalized } from "@prostcounter/shared/utils";
import { buildWrappedStory, resolveWrappedFestivalId } from "@prostcounter/shared/wrapped";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { StoryShell } from "@/components/wrapped/story/story-shell";
import { WrappedStateScreen } from "@/components/wrapped/wrapped-state-screen";
import { Colors } from "@/lib/constants/colors";

export default function WrappedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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

  // Built once per ready payload, not on every render: a refetch that changes
  // the slide count would otherwise leave the shell's reducer holding a
  // `total` from the previous build, crashing on the now out-of-range index.
  const readyResult = result?.status === "ready" ? result : null;
  const slides = useMemo(() => {
    if (!readyResult) {
      return null;
    }
    return buildWrappedStory(readyResult.wrapped, readyResult.officialStats);
  }, [readyResult]);

  // Nothing to go back to when the screen was opened from a deep link or cold start.
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-wrapped-paper">
        <VStack space="md" className="items-center">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-base text-wrapped-ink">{t("wrapped.loading")}</Text>
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

  if (!slides) {
    return null;
  }

  return (
    // Keyed on slide count: a refetch that changes it remounts the shell
    // instead of leaving its reducer's `total` stale (see the useMemo above).
    <StoryShell key={slides.length} data={result.wrapped} slides={slides} onClose={handleClose} />
  );
}
