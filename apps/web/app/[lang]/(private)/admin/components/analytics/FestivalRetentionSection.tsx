"use client";

import { useAdminAnalyticsFestivalRetention } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  formatPercent,
  retentionRates,
  visibleFestivalRetentionRows,
} from "@prostcounter/shared/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AnalyticsSectionCard from "./AnalyticsSectionCard";

export default function FestivalRetentionSection() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsFestivalRetention();

  const festivals = visibleFestivalRetentionRows(data?.festivals ?? []);

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.retention")}
      description={t("admin.analytics.retention.hint")}
      isLoading={loading}
      error={error}
      isEmpty={festivals.length === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.analytics.retention.festival")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.retention.attendees")}</TableHead>
            <TableHead className="text-right">
              {t("admin.analytics.retention.returnedNext")}
            </TableHead>
            <TableHead className="text-right">
              {t("admin.analytics.retention.returnedAny")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {festivals.map((festival) => {
            const rates = retentionRates(festival);
            return (
              <TableRow key={festival.festivalId}>
                <TableCell>{festival.festivalName}</TableCell>
                <TableCell className="text-right">{festival.attendees}</TableCell>
                <TableCell className="text-right">
                  {festival.returnedNext === null ? (
                    <span
                      className="text-muted-foreground"
                      title={t("admin.analytics.retention.pending")}
                    >
                      {formatPercent(null)}
                    </span>
                  ) : (
                    `${festival.returnedNext} (${formatPercent(rates.next)})`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {`${festival.returnedAny} (${formatPercent(rates.any)})`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </AnalyticsSectionCard>
  );
}
