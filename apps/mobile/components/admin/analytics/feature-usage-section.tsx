import { useAdminAnalyticsFeatures } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatPercent, withFeatureReach } from "@prostcounter/shared/utils";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BarList } from "./bar-list";
import { SectionState } from "./section-state";

interface FeatureUsageSectionProps {
  from: string;
  to: string;
}

export function FeatureUsageSection({ from, to }: FeatureUsageSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsFeatures({ from, to });

  const activeUsers = data?.activeUsers ?? 0;
  const rows = withFeatureReach(data?.features ?? [], activeUsers);

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={rows.every((row) => row.users === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <Text className="text-sm text-typography-500">
          {t("admin.analytics.features.activeUsers", { count: activeUsers })}
        </Text>
        <BarList
          items={rows.map((row) => ({
            key: row.feature,
            label: t(`admin.analytics.features.names.${row.feature}`),
            value: row.users,
            detail: row.isDead
              ? `${row.users} · ${formatPercent(row.reach)} · ${t("admin.analytics.features.dead")}`
              : `${row.users} · ${formatPercent(row.reach)}`,
            muted: row.isDead,
          }))}
        />
      </VStack>
    </SectionState>
  );
}
