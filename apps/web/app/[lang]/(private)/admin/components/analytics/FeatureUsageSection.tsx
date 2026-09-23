"use client";

import { useAdminAnalyticsFeatures } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatPercent, withFeatureReach } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AnalyticsSectionCard from "./AnalyticsSectionCard";

interface FeatureUsageSectionProps {
  from: string;
  to: string;
}

export default function FeatureUsageSection({ from, to }: FeatureUsageSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsFeatures({ from, to });

  const activeUsers = data?.activeUsers ?? 0;
  const rows = withFeatureReach(data?.features ?? [], activeUsers);

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.features")}
      description={t("admin.analytics.features.activeUsers", { count: activeUsers })}
      isLoading={loading}
      error={error}
      isEmpty={rows.every((row) => row.users === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.analytics.features.feature")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.features.users")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.features.reach")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.features.events")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.feature} className={cn(row.isDead && "text-muted-foreground")}>
              <TableCell>
                <span className="flex items-center gap-2">
                  {t(`admin.analytics.features.names.${row.feature}`)}
                  {row.isDead && (
                    <Badge variant="secondary">{t("admin.analytics.features.dead")}</Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right">{row.users}</TableCell>
              <TableCell className="text-right">{formatPercent(row.reach)}</TableCell>
              <TableCell className="text-right">{row.events}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AnalyticsSectionCard>
  );
}
