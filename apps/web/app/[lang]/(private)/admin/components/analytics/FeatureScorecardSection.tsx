"use client";

import { useAdminAnalyticsScorecard } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  formatLift,
  formatPercent,
  type ScorecardComparison,
  type ScorecardHint,
  scoreFeature,
} from "@prostcounter/shared/utils";

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
      description={`${scope} ${t("admin.analytics.scorecard.hint")}`}
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
                {t(`admin.analytics.features.names.${feature.feature}`)}
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
    </AnalyticsSectionCard>
  );
}
