"use client";

import { useAdminAnalyticsCohorts } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cohortRates, formatPercent } from "@prostcounter/shared/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AnalyticsSectionCard from "./AnalyticsSectionCard";

export default function SignupCohortsSection() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsCohorts();

  const cohorts = data?.cohorts ?? [];

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.cohorts")}
      description={t("admin.analytics.cohorts.hint")}
      isLoading={loading}
      error={error}
      isEmpty={cohorts.length === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.analytics.cohorts.month")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.cohorts.signups")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.cohorts.activated")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.cohorts.activated7d")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.cohorts.engaged")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.cohorts.returned")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cohorts.map((cohort) => {
            const rates = cohortRates(cohort);
            return (
              <TableRow key={cohort.month}>
                <TableCell className="text-left">{cohort.month.slice(0, 7)}</TableCell>
                <TableCell className="text-right">{cohort.signups}</TableCell>
                <TableCell className="text-right">
                  {`${cohort.activated} (${formatPercent(rates.activated)})`}
                </TableCell>
                <TableCell className="text-right">
                  {`${cohort.activated7d} (${formatPercent(rates.activated7d)})`}
                </TableCell>
                <TableCell className="text-right">
                  {`${cohort.engaged} (${formatPercent(rates.engaged)})`}
                </TableCell>
                <TableCell className="text-right">
                  {`${cohort.returned} (${formatPercent(rates.returned)})`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </AnalyticsSectionCard>
  );
}
