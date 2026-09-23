import { useAdminAnalyticsActivationFunnel } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform } from "@prostcounter/shared/schemas";
import { formatPercent, funnelConversion } from "@prostcounter/shared/utils";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BarList } from "./bar-list";
import { SectionState } from "./section-state";

interface ActivationFunnelSectionProps {
  from: string;
  to: string;
  platform?: AnalyticsPlatform;
}

export function ActivationFunnelSection({ from, to, platform }: ActivationFunnelSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsActivationFunnel({ from, to, platform });

  const steps = funnelConversion(data?.steps ?? []);
  const signups = steps[0]?.users ?? 0;

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={signups === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <Text className="text-sm text-typography-500">{t("admin.analytics.funnel.hint")}</Text>
        <BarList
          max={signups}
          items={steps.map((step) => ({
            key: step.step,
            label: t(`admin.analytics.funnel.steps.${step.step}`),
            value: step.users,
            detail: `${step.users} · ${t("admin.analytics.funnel.ofSignups", {
              percent: formatPercent(step.fromStart),
            })}`,
          }))}
        />
      </VStack>
    </SectionState>
  );
}
