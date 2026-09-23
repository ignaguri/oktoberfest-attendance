import { useAdminAnalyticsOverview } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform } from "@prostcounter/shared/schemas";
import { formatPercent, summarizeOverview } from "@prostcounter/shared/utils";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { KpiTile } from "./kpi-tile";
import { SectionState } from "./section-state";

interface OverviewSectionProps {
  from: string;
  to: string;
  platform?: AnalyticsPlatform;
}

export function OverviewSection({ from, to, platform }: OverviewSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsOverview({ from, to, platform });

  const series = data?.series ?? [];
  const summary = summarizeOverview(series);

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={series.every((point) => point.mau === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <HStack space="md">
          <KpiTile
            label={t("admin.analytics.overview.dau")}
            value={String(summary.dau)}
            series={series.map((point) => point.dau)}
          />
          <KpiTile
            label={t("admin.analytics.overview.wau")}
            value={String(summary.wau)}
            series={series.map((point) => point.wau)}
          />
        </HStack>
        <HStack space="md">
          <KpiTile
            label={t("admin.analytics.overview.mau")}
            value={String(summary.mau)}
            series={series.map((point) => point.mau)}
          />
          <KpiTile
            label={t("admin.analytics.overview.stickiness")}
            value={formatPercent(summary.stickiness)}
          />
        </HStack>
      </VStack>
    </SectionState>
  );
}
