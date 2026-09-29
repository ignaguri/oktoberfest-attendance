import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack, useLocalSearchParams } from "expo-router";

import { ActivationFunnelSection } from "@/components/admin/analytics/activation-funnel-section";
import { FeatureScorecardSection } from "@/components/admin/analytics/feature-scorecard-section";
import { FeatureUsageSection } from "@/components/admin/analytics/feature-usage-section";
import { FestivalRetentionSection } from "@/components/admin/analytics/festival-retention-section";
import { OverviewSection } from "@/components/admin/analytics/overview-section";
import { parseAnalyticsSection } from "@/components/admin/analytics/sections";
import { SignupCohortsSection } from "@/components/admin/analytics/signup-cohorts-section";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function AdminAnalyticsSectionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    section: string;
    from?: string;
    to?: string;
    platform?: string;
    festivalId?: string;
    festivalName?: string;
  }>();

  const section = parseAnalyticsSection(params.section);
  const platform =
    params.platform === "ios" || params.platform === "android" ? params.platform : undefined;

  if (!section || !params.from || !params.to) {
    return <ErrorState message={t("admin.analytics.loadError")} showRetry={false} />;
  }

  const { from, to } = params;

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <Stack.Screen options={{ title: t(`admin.analytics.sections.${section}`) }} />
      <VStack space="md">
        {section !== "retention" && section !== "scorecard" && section !== "cohorts" && (
          <Text className="text-sm text-typography-500">
            {from} – {to}
          </Text>
        )}
        {section === "overview" && <OverviewSection from={from} to={to} platform={platform} />}
        {section === "features" && <FeatureUsageSection from={from} to={to} platform={platform} />}
        {section === "funnel" && <ActivationFunnelSection from={from} to={to} platform={platform} />}
        {section === "retention" && <FestivalRetentionSection />}
        {section === "scorecard" && (
          <>
            <Text className="text-sm text-typography-500">
              {params.festivalId
                ? t("admin.analytics.scorecard.scopeFestival", {
                    festival: params.festivalName ?? params.festivalId,
                  })
                : t("admin.analytics.scorecard.scopeAll")}
            </Text>
            <FeatureScorecardSection
              festivalId={params.festivalId}
              festivalName={params.festivalName}
            />
          </>
        )}
        {section === "cohorts" && <SignupCohortsSection />}
      </VStack>
    </ScrollView>
  );
}
