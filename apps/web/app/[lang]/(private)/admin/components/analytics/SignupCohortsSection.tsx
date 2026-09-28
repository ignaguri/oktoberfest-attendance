"use client";

import {
  useAdminAnalyticsCohortMembers,
  useAdminAnalyticsCohorts,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ANALYTICS_COHORT_STEPS } from "@prostcounter/shared/schemas";
import type { AnalyticsCohortStep } from "@prostcounter/shared/schemas";
import {
  cohortRates,
  cohortStepCount,
  cohortStepLabelKey,
  formatPercent,
} from "@prostcounter/shared/utils";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AnalyticsSectionCard from "./AnalyticsSectionCard";
import MemberListDialog from "./MemberListDialog";

export default function SignupCohortsSection() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsCohorts();

  const cohorts = data?.cohorts ?? [];

  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [step, setStep] = useState<AnalyticsCohortStep>("signups");
  const members = useAdminAnalyticsCohortMembers(
    { month: openMonth ?? "1970-01-01", step },
    openMonth !== null,
  );
  const openRow = cohorts.find((cohort) => cohort.month === openMonth);

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.cohorts")}
      description={`${t("admin.analytics.cohorts.hint")} ${t("admin.analytics.members.tapHint")}`}
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
                <TableCell className="text-left">
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => {
                      setStep("signups");
                      setOpenMonth(cohort.month);
                    }}
                  >
                    {cohort.month.slice(0, 7)}
                  </button>
                </TableCell>
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
      {openMonth && (
        <MemberListDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setOpenMonth(null);
            }
          }}
          label={`${openMonth.slice(0, 7)} · ${t(cohortStepLabelKey(step))}`}
          count={openRow ? cohortStepCount(openRow, step) : 0}
          chips={ANALYTICS_COHORT_STEPS.map((value) => ({
            value,
            label: t(cohortStepLabelKey(value)),
          }))}
          selectedChip={step}
          onChipChange={(value) => setStep(value as AnalyticsCohortStep)}
          members={members.data?.members ?? []}
          truncated={members.data?.truncated ?? false}
          isLoading={members.loading}
          error={members.error}
          onRetry={() => {
            void members.refetch();
          }}
        />
      )}
    </AnalyticsSectionCard>
  );
}
