"use client";

import { useAdminAnalyticsOverview } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform } from "@prostcounter/shared/schemas";
import { formatPercent, summarizeOverview } from "@prostcounter/shared/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AnalyticsSectionCard from "./AnalyticsSectionCard";

interface OverviewSectionProps {
  from: string;
  to: string;
  platform?: AnalyticsPlatform;
}

const LINE_COLORS = { dau: "#F59E0B", wau: "#D97706", mau: "#78716C" } as const;

export default function OverviewSection({ from, to, platform }: OverviewSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsOverview({ from, to, platform });

  const series = data?.series ?? [];
  const summary = summarizeOverview(series);
  const tiles = [
    { key: "dau", value: String(summary.dau) },
    { key: "wau", value: String(summary.wau) },
    { key: "mau", value: String(summary.mau) },
    { key: "stickiness", value: formatPercent(summary.stickiness) },
  ] as const;

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.overview")}
      isLoading={loading}
      error={error}
      isEmpty={series.every((point) => point.mau === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              {t(`admin.analytics.overview.${tile.key}`)}
            </div>
            <div className="text-2xl font-semibold">{tile.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 mb-2 text-sm font-medium">{t("admin.analytics.overview.chartTitle")}</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            {(["dau", "wau", "mau"] as const).map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                name={t(`admin.analytics.overview.${metric}`)}
                stroke={LINE_COLORS[metric]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsSectionCard>
  );
}
