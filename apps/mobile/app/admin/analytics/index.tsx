import {
  useAdminAnalyticsActivationFunnel,
  useAdminAnalyticsFeatures,
  useAdminAnalyticsFestivalRetention,
  useAdminAnalyticsOverview,
  useFestivals,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform, Festival } from "@prostcounter/shared/schemas";
import {
  DEFAULT_ANALYTICS_RANGE_PRESET,
  formatPercent,
  funnelConversion,
  resolveAnalyticsRange,
  retentionRates,
  summarizeOverview,
} from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";

import { AnalyticsFilters } from "@/components/admin/analytics/analytics-filters";
import { ANALYTICS_SECTIONS, type AnalyticsSection } from "@/components/admin/analytics/sections";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export default function AdminAnalyticsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: festivals } = useFestivals() as { data: Festival[] | null | undefined };

  const [rangeKey, setRangeKey] = useState<string>(DEFAULT_ANALYTICS_RANGE_PRESET);
  const [platform, setPlatform] = useState<AnalyticsPlatform | undefined>(undefined);
  const range = useMemo(() => resolveAnalyticsRange(rangeKey, festivals), [rangeKey, festivals]);

  const overview = useAdminAnalyticsOverview({ ...range, platform });
  const features = useAdminAnalyticsFeatures(range);
  const funnel = useAdminAnalyticsActivationFunnel(range);
  const retention = useAdminAnalyticsFestivalRetention();

  const empty = t("admin.analytics.empty");

  const summary = summarizeOverview(overview.data?.series ?? []);
  const topFeature = features.data?.features.find((row) => row.users > 0);
  const attendanceStep = funnelConversion(funnel.data?.steps ?? []).find(
    (step) => step.step === "logged_attendance",
  );
  const latestFestival = retention.data?.festivals.find(
    (festival) => festival.returnedNext !== null && festival.attendees > 0,
  );

  const headlines: Record<AnalyticsSection, string> = {
    overview:
      summary.mau > 0
        ? t("admin.analytics.overview.headline", { dau: summary.dau, mau: summary.mau })
        : empty,
    features: topFeature
      ? t("admin.analytics.features.headline", {
          feature: t(`admin.analytics.features.names.${topFeature.feature}`),
        })
      : empty,
    funnel:
      attendanceStep && attendanceStep.fromStart !== null
        ? t("admin.analytics.funnel.headline", {
            percent: formatPercent(attendanceStep.fromStart),
          })
        : empty,
    retention: latestFestival
      ? t("admin.analytics.retention.headline", {
          percent: formatPercent(retentionRates(latestFestival).next),
          festival: latestFestival.festivalName,
        })
      : empty,
  };

  const states: Record<AnalyticsSection, { loading: boolean; error: Error | null }> = {
    overview: { loading: overview.loading, error: overview.error },
    features: { loading: features.loading, error: features.error },
    funnel: { loading: funnel.loading, error: funnel.error },
    retention: { loading: retention.loading, error: retention.error },
  };

  const openSection = (section: AnalyticsSection) => {
    router.push({
      pathname: "/admin/analytics/[section]",
      params: {
        section,
        from: range.from,
        to: range.to,
        ...(platform ? { platform } : {}),
      },
    });
  };

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <AnalyticsFilters
          rangeKey={rangeKey}
          onRangeKeyChange={setRangeKey}
          platform={platform}
          onPlatformChange={setPlatform}
        />
        <Text className="text-sm text-typography-500">
          {range.from} – {range.to}
        </Text>

        <Card size="md" variant="elevated" className="overflow-hidden p-0">
          <VStack>
            {ANALYTICS_SECTIONS.map((section, index) => {
              const state = states[section];
              let subtitle = headlines[section];
              if (state.loading) {
                subtitle = "…";
              } else if (state.error) {
                subtitle = t("admin.analytics.loadError");
              }
              return (
                <Pressable
                  key={section}
                  className={cn(
                    "flex-row items-center gap-3 px-4 py-3.5",
                    index < ANALYTICS_SECTIONS.length - 1 && "border-b border-outline-100",
                  )}
                  onPress={() => openSection(section)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`admin.analytics.sections.${section}`)}
                  accessibilityHint={subtitle}
                >
                  <View className="flex-1">
                    <Text className="text-typography-900">
                      {t(`admin.analytics.sections.${section}`)}
                    </Text>
                    <Text className="text-sm text-typography-500">{subtitle}</Text>
                  </View>
                  <ChevronRight size={20} color={IconColors.muted} />
                </Pressable>
              );
            })}
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}
