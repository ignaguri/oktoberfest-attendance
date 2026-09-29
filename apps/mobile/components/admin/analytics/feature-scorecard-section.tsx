import { useAdminAnalyticsScorecard } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  formatLift,
  formatPercent,
  type ScorecardComparison,
  type ScorecardHint,
  scoreFeature,
} from "@prostcounter/shared/utils";
import { useRouter } from "expo-router";

import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { membersRouteParams } from "@/lib/admin/analytics-members-params";

import { SectionState } from "./section-state";

const HINT_ACTIONS: Record<ScorecardHint, "error" | "success" | "info" | "muted"> = {
  cut: "error",
  grow: "success",
  keep: "info",
  unknown: "muted",
};

interface FeatureScorecardSectionProps {
  /** Undefined means every festival, pooled. */
  festivalId?: string;
  /** Shown on the members screen. */
  festivalName?: string;
}

export function FeatureScorecardSection({ festivalId, festivalName }: FeatureScorecardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminAnalyticsScorecard(festivalId);

  const scored = (data?.features ?? []).map(scoreFeature);

  const comparisonText = (comparison: ScorecardComparison): string => {
    if (comparison.status === "notApplicable") {
      return t("admin.analytics.scorecard.notApplicable");
    }
    if (comparison.status === "tooFew") {
      return t("admin.analytics.scorecard.tooFew", {
        users: comparison.users,
        usersBase: comparison.usersBase,
        nonUsers: comparison.nonUsers,
        nonUsersBase: comparison.nonUsersBase,
      });
    }
    return t("admin.analytics.scorecard.compared", {
      users: formatPercent(comparison.usersRate),
      nonUsers: formatPercent(comparison.nonUsersRate),
      lift: formatLift(comparison.liftPoints),
    });
  };

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={scored.every((feature) => feature.attendees === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <Text className="text-sm text-typography-500">
          {`${t("admin.analytics.scorecard.hint")} ${t("admin.analytics.members.tapHint")}`}
        </Text>
        {scored.map((feature) => (
          <Pressable
            key={feature.feature}
            onPress={() =>
              router.push({
                pathname: "/admin/analytics/members",
                params: membersRouteParams({
                  metric: "scorecard",
                  festivalId,
                  festivalName,
                  feature: feature.feature,
                  segment: "adopters",
                }),
              })
            }
            accessibilityRole="button"
            accessibilityLabel={t(`admin.analytics.features.names.${feature.feature}`)}
            accessibilityHint={t("admin.analytics.members.tapHint")}
          >
            <Card size="sm" variant="outline" className="bg-background-0">
              <VStack space="xs">
                <HStack className="items-center justify-between">
                  <Text className="font-semibold text-typography-900">
                    {t(`admin.analytics.features.names.${feature.feature}`)}
                  </Text>
                  <Badge action={HINT_ACTIONS[feature.hint]}>
                    <BadgeText>{t(`admin.analytics.scorecard.hints.${feature.hint}`)}</BadgeText>
                  </Badge>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-sm text-typography-500">
                    {t("admin.analytics.scorecard.adoption")}
                  </Text>
                  <Text className="text-sm text-typography-900">
                    {`${feature.adopters} / ${feature.attendees} · ${formatPercent(feature.adoption)}`}
                  </Text>
                </HStack>
                <VStack>
                  <Text className="text-sm text-typography-500">
                    {`${t("admin.analytics.scorecard.cameBack")} (${t("admin.analytics.scorecard.legend")})`}
                  </Text>
                  <Text className="text-sm text-typography-900">
                    {comparisonText(feature.cameBack)}
                  </Text>
                </VStack>
                <VStack>
                  <Text className="text-sm text-typography-500">
                    {`${t("admin.analytics.scorecard.returned")} (${t("admin.analytics.scorecard.legend")})`}
                  </Text>
                  <Text className="text-sm text-typography-900">
                    {comparisonText(feature.returned)}
                  </Text>
                </VStack>
              </VStack>
            </Card>
          </Pressable>
        ))}
      </VStack>
    </SectionState>
  );
}
