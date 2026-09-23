"use client";

import { useAdminAnalyticsActivationFunnel } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatPercent, funnelConversion } from "@prostcounter/shared/utils";

import AnalyticsSectionCard from "./AnalyticsSectionCard";

interface ActivationFunnelSectionProps {
  from: string;
  to: string;
}

export default function ActivationFunnelSection({ from, to }: ActivationFunnelSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsActivationFunnel({ from, to });

  const steps = funnelConversion(data?.steps ?? []);

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.funnel")}
      description={t("admin.analytics.funnel.hint")}
      isLoading={loading}
      error={error}
      isEmpty={(steps[0]?.users ?? 0) === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <div className="flex flex-col gap-3">
        {steps.map((step) => (
          <div key={step.step} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
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
          </div>
        ))}
      </div>
    </AnalyticsSectionCard>
  );
}
