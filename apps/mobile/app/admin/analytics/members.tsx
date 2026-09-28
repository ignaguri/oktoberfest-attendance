import type { DataQueryResult } from "@prostcounter/shared/data";
import {
  useAdminAnalyticsActivationFunnel,
  useAdminAnalyticsCohortMembers,
  useAdminAnalyticsCohorts,
  useAdminAnalyticsFunnelMembers,
  useAdminAnalyticsScorecard,
  useAdminAnalyticsScorecardMembers,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  ANALYTICS_COHORT_STEPS,
  ANALYTICS_SCORECARD_SEGMENTS,
  type AnalyticsCohortStep,
  type AnalyticsMembersResponse,
  type AnalyticsScorecardSegment,
} from "@prostcounter/shared/schemas";
import { cohortStepCount, scorecardSegmentCount } from "@prostcounter/shared/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useState } from "react";

import { Chip } from "@/components/admin/analytics/chip";
import { MemberList } from "@/components/admin/analytics/member-list";
import { SectionState } from "@/components/admin/analytics/section-state";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { type MembersTarget, parseMembersParams } from "@/lib/admin/analytics-members-params";

interface MembersBodyProps {
  label: string;
  count: number;
  subtitle?: string;
  chips?: ReactNode;
  members: DataQueryResult<AnalyticsMembersResponse>;
  showFestival: boolean;
}

/** Header, optional chips and the list; shared by the three metrics. */
function MembersBody({ label, count, subtitle, chips, members, showFestival }: MembersBodyProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const list = members.data?.members ?? [];

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <Text className="font-semibold text-typography-900">
          {t("admin.analytics.members.title", { label, count })}
        </Text>
        {subtitle && <Text className="text-sm text-typography-500">{subtitle}</Text>}
        {chips}
        {members.data?.truncated && (
          <Text className="text-sm text-typography-500">
            {t("admin.analytics.members.truncated", { count: list.length })}
          </Text>
        )}
        <SectionState
          isLoading={members.loading}
          error={members.error}
          isEmpty={list.length === 0}
          onRetry={() => {
            void members.refetch();
          }}
        >
          <MemberList
            members={list}
            showFestival={showFestival}
            onOpen={(userId) => router.push(`/admin/user/${userId}`)}
          />
        </SectionState>
      </VStack>
    </ScrollView>
  );
}

type FunnelTarget = Extract<MembersTarget, { metric: "funnel" }>;
type ScorecardTarget = Extract<MembersTarget, { metric: "scorecard" }>;
type CohortTarget = Extract<MembersTarget, { metric: "cohorts" }>;

function FunnelMembers({ target }: { target: FunnelTarget }) {
  const { t } = useTranslation();
  const query = { from: target.from, to: target.to, platform: target.platform, step: target.step };
  const funnel = useAdminAnalyticsActivationFunnel(query);
  const members = useAdminAnalyticsFunnelMembers(query);

  return (
    <MembersBody
      label={t(`admin.analytics.funnel.steps.${target.step}`)}
      count={funnel.data?.steps.find((step) => step.step === target.step)?.users ?? 0}
      members={members}
      showFestival={false}
    />
  );
}

function ScorecardMembers({ target }: { target: ScorecardTarget }) {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<AnalyticsScorecardSegment>(target.segment);
  const scorecard = useAdminAnalyticsScorecard(target.festivalId);
  const members = useAdminAnalyticsScorecardMembers({
    festivalId: target.festivalId,
    feature: target.feature,
    segment,
  });
  const row = scorecard.data?.features.find((candidate) => candidate.feature === target.feature);

  return (
    <MembersBody
      label={`${t(`admin.analytics.features.names.${target.feature}`)} · ${t(`admin.analytics.members.segments.${segment}`)}`}
      count={row ? scorecardSegmentCount(row, segment) : 0}
      subtitle={target.festivalName}
      chips={
        <HStack space="sm" className="flex-wrap">
          {ANALYTICS_SCORECARD_SEGMENTS.map((value) => (
            <Chip
              key={value}
              label={t(`admin.analytics.members.segments.${value}`)}
              selected={value === segment}
              onPress={() => setSegment(value)}
              accessibilityHint={t("admin.analytics.members.chipHint")}
            />
          ))}
        </HStack>
      }
      members={members}
      showFestival={!target.festivalId}
    />
  );
}

function CohortMembers({ target }: { target: CohortTarget }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<AnalyticsCohortStep>(target.step);
  const cohorts = useAdminAnalyticsCohorts();
  const members = useAdminAnalyticsCohortMembers({ month: target.month, step });
  const row = cohorts.data?.cohorts.find((candidate) => candidate.month === target.month);

  return (
    <MembersBody
      label={`${target.month.slice(0, 7)} · ${t(`admin.analytics.members.cohortSteps.${step}`)}`}
      count={row ? cohortStepCount(row, step) : 0}
      chips={
        <HStack space="sm" className="flex-wrap">
          {ANALYTICS_COHORT_STEPS.map((value) => (
            <Chip
              key={value}
              label={t(`admin.analytics.members.cohortSteps.${value}`)}
              selected={value === step}
              onPress={() => setStep(value)}
              accessibilityHint={t("admin.analytics.members.chipHint")}
            />
          ))}
        </HStack>
      }
      members={members}
      showFestival={false}
    />
  );
}

export default function AdminAnalyticsMembersScreen() {
  const { t } = useTranslation();
  const target = parseMembersParams(useLocalSearchParams());

  if (!target) {
    return <ErrorState message={t("admin.analytics.loadError")} showRetry={false} />;
  }
  if (target.metric === "funnel") {
    return <FunnelMembers target={target} />;
  }
  if (target.metric === "scorecard") {
    return <ScorecardMembers target={target} />;
  }
  return <CohortMembers target={target} />;
}
