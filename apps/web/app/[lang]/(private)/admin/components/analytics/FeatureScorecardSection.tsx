"use client";

import {
  useAdminAnalyticsScorecard,
  useAdminAnalyticsScorecardMembers,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ANALYTICS_SCORECARD_SEGMENTS } from "@prostcounter/shared/schemas";
import type {
  AnalyticsScorecardFeature,
  AnalyticsScorecardSegment,
} from "@prostcounter/shared/schemas";
import {
  formatLift,
  formatPercent,
  scorecardSegmentCount,
  type ScorecardComparison,
  type ScorecardHint,
  scoreFeature,
} from "@prostcounter/shared/utils";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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

const HINT_VARIANTS: Record<ScorecardHint, "destructive" | "success" | "secondary" | "outline"> = {
  cut: "destructive",
  grow: "success",
  keep: "secondary",
  unknown: "outline",
};

interface FeatureScorecardSectionProps {
  /** Undefined means every festival, pooled. */
  festivalId?: string;
  /** Shown in the description when a festival is selected. */
  festivalName?: string;
}

export default function FeatureScorecardSection({
  festivalId,
  festivalName,
}: FeatureScorecardSectionProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsScorecard(festivalId);

  const scored = (data?.features ?? []).map(scoreFeature);

  const [openFeature, setOpenFeature] = useState<AnalyticsScorecardFeature | null>(null);
  const [segment, setSegment] = useState<AnalyticsScorecardSegment>("adopters");
  const members = useAdminAnalyticsScorecardMembers(
    { festivalId, feature: openFeature ?? "drinks", segment },
    openFeature !== null,
  );
  const openRow = data?.features.find((row) => row.feature === openFeature);

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

  const scope = festivalId
    ? t("admin.analytics.scorecard.scopeFestival", { festival: festivalName ?? festivalId })
    : t("admin.analytics.scorecard.scopeAll");

  return (
    <AnalyticsSectionCard
      title={t("admin.analytics.sections.scorecard")}
      description={`${scope} ${t("admin.analytics.scorecard.hint")} ${t("admin.analytics.members.tapHint")}`}
      isLoading={loading}
      error={error}
      isEmpty={scored.every((feature) => feature.attendees === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.analytics.scorecard.feature")}</TableHead>
            <TableHead className="text-right">{t("admin.analytics.scorecard.adoption")}</TableHead>
            <TableHead className="text-right">
              {t("admin.analytics.scorecard.cameBack")}
              <span className="block text-xs font-normal text-muted-foreground">
                {t("admin.analytics.scorecard.legend")}
              </span>
            </TableHead>
            <TableHead className="text-right">
              {t("admin.analytics.scorecard.returned")}
              <span className="block text-xs font-normal text-muted-foreground">
                {t("admin.analytics.scorecard.legend")}
              </span>
            </TableHead>
            <TableHead>{t("admin.analytics.scorecard.hintColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scored.map((feature) => (
            <TableRow key={feature.feature}>
              <TableCell className="text-left">
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => {
                    setSegment("adopters");
                    setOpenFeature(feature.feature);
                  }}
                >
                  {t(`admin.analytics.features.names.${feature.feature}`)}
                </button>
              </TableCell>
              <TableCell className="text-right">
                {`${feature.adopters} / ${feature.attendees} · ${formatPercent(feature.adoption)}`}
              </TableCell>
              <TableCell className="text-right">{comparisonText(feature.cameBack)}</TableCell>
              <TableCell className="text-right">{comparisonText(feature.returned)}</TableCell>
              <TableCell className="text-left">
                <Badge variant={HINT_VARIANTS[feature.hint]}>
                  {t(`admin.analytics.scorecard.hints.${feature.hint}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {openFeature && (
        <MemberListDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setOpenFeature(null);
            }
          }}
          label={`${t(`admin.analytics.features.names.${openFeature}`)} · ${t(`admin.analytics.members.segments.${segment}`)}`}
          count={openRow ? scorecardSegmentCount(openRow, segment) : 0}
          chips={ANALYTICS_SCORECARD_SEGMENTS.map((value) => ({
            value,
            label: t(`admin.analytics.members.segments.${value}`),
          }))}
          selectedChip={segment}
          onChipChange={(value) => setSegment(value as AnalyticsScorecardSegment)}
          members={members.data?.members ?? []}
          truncated={members.data?.truncated ?? false}
          isLoading={members.loading}
          error={members.error}
          onRetry={() => {
            void members.refetch();
          }}
          showFestival={!festivalId}
        />
      )}
    </AnalyticsSectionCard>
  );
}
