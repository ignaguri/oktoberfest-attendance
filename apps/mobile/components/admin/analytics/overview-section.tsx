import { useAdminAnalyticsOverview } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform } from "@prostcounter/shared/schemas";
import {
  formatChartDayTick,
  formatPercent,
  OVERVIEW_SERIES,
  overviewChartRows,
  summarizeOverview,
} from "@prostcounter/shared/utils";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { LineChart } from "./line-chart";
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
          <KpiTile label={t("admin.analytics.overview.dau")} value={String(summary.dau)} />
          <KpiTile label={t("admin.analytics.overview.wau")} value={String(summary.wau)} />
        </HStack>
        <HStack space="md">
          <KpiTile label={t("admin.analytics.overview.mau")} value={String(summary.mau)} />
          <KpiTile
            label={t("admin.analytics.overview.stickiness")}
            value={formatPercent(summary.stickiness)}
          />
        </HStack>
        <Text className="font-semibold text-typography-900">
          {t("admin.analytics.overview.chartTitle")}
        </Text>
        <LineChart
          rows={overviewChartRows(series)}
          series={OVERVIEW_SERIES}
          formatXTick={formatChartDayTick}
        />
      </VStack>
    </SectionState>
  );
}
