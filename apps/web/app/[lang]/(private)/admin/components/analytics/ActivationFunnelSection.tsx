"use client";

import {
  useAdminAnalyticsActivationFunnel,
  useAdminAnalyticsFunnelMembers,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsFunnelStepName, AnalyticsPlatform } from "@prostcounter/shared/schemas";
import { formatPercent, funnelConversion } from "@prostcounter/shared/utils";
import { useState } from "react";

import AnalyticsSectionCard from "./AnalyticsSectionCard";
import MemberListDialog from "./MemberListDialog";

interface ActivationFunnelSectionProps {
  from: string;
  to: string;
  platform?: AnalyticsPlatform;
}

export default function ActivationFunnelSection({ from, to, platform }: ActivationFunnelSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsActivationFunnel({ from, to, platform });
  const [openStep, setOpenStep] = useState<AnalyticsFunnelStepName | null>(null);
  const members = useAdminAnalyticsFunnelMembers(
    { from, to, platform, step: openStep ?? "signed_up" },
    openStep !== null,
  );

  const steps = funnelConversion(data?.steps ?? []);
  const openRow = steps.find((step) => step.step === openStep);

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.funnel")}
      description={`${t("admin.analytics.funnel.hint")}. ${t("admin.analytics.members.tapHint")}`}
      isLoading={loading}
      error={error}
      isEmpty={(steps[0]?.users ?? 0) === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <div className="flex flex-col gap-3">
        {steps.map((step) => (
          <button
            key={step.step}
            type="button"
            onClick={() => setOpenStep(step.step)}
            className="flex flex-col gap-1 rounded text-left hover:bg-muted/50"
          >
            <div className="flex w-full justify-between text-sm">
              <span>{t(`admin.analytics.funnel.steps.${step.step}`)}</span>
              <span className="text-muted-foreground">
                {step.users} ·{" "}
                {t("admin.analytics.funnel.ofSignups", { percent: formatPercent(step.fromStart) })}
              </span>
            </div>
            <div className="h-3 w-full rounded bg-muted">
              {/* Width is data, so it cannot be a Tailwind class. */}
              <div
                className="h-3 rounded bg-yellow-500"
                style={{ width: `${Math.round((step.fromStart ?? 0) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
      {openStep && (
        <MemberListDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setOpenStep(null);
            }
          }}
          label={t(`admin.analytics.funnel.steps.${openStep}`)}
          count={openRow?.users ?? 0}
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
