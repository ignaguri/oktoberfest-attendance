import { useAdminAnalyticsCohorts } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cohortRates, formatPercent } from "@prostcounter/shared/utils";
import { useRouter } from "expo-router";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { membersRouteParams } from "@/lib/admin/analytics-members-params";

import { SectionState } from "./section-state";

export function SignupCohortsSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminAnalyticsCohorts();

  const cohorts = data?.cohorts ?? [];

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={cohorts.length === 0}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <Text className="text-sm text-typography-500">
          {`${t("admin.analytics.cohorts.hint")} ${t("admin.analytics.members.tapHint")}`}
        </Text>
        {cohorts.map((cohort) => {
          const rates = cohortRates(cohort);
          const steps = [
            { key: "activated", count: cohort.activated, rate: rates.activated },
            { key: "activated7d", count: cohort.activated7d, rate: rates.activated7d },
            { key: "engaged", count: cohort.engaged, rate: rates.engaged },
            { key: "returned", count: cohort.returned, rate: rates.returned },
          ] as const;
          return (
            <Pressable
              key={cohort.month}
              onPress={() =>
                router.push({
                  pathname: "/admin/analytics/members",
                  params: membersRouteParams({ metric: "cohorts", month: cohort.month, step: "signups" }),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={cohort.month.slice(0, 7)}
              accessibilityHint={t("admin.analytics.members.tapHint")}
            >
              <Card size="sm" variant="outline" className="bg-background-0">
                <VStack space="xs">
                  <HStack className="justify-between">
                    <Text className="font-semibold text-typography-900">
                      {cohort.month.slice(0, 7)}
                    </Text>
                    <Text className="text-sm text-typography-900">
                      {`${cohort.signups} ${t("admin.analytics.cohorts.signups")}`}
                    </Text>
                  </HStack>
                  {steps.map((step) => (
                    <HStack key={step.key} className="justify-between">
                      <Text className="text-sm text-typography-500">
                        {t(`admin.analytics.cohorts.${step.key}`)}
                      </Text>
                      <Text className="text-sm text-typography-900">
                        {`${step.count} (${formatPercent(step.rate)})`}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </Card>
            </Pressable>
          );
        })}
      </VStack>
    </SectionState>
  );
}
