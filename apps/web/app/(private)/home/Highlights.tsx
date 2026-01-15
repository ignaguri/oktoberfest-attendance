"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkeletonHighlights } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { useHighlights } from "@/hooks/useProfile";
import { getDefaultBeerCost } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";

const Highlights = () => {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    data: highlightsData,
    loading: highlightsLoading,
    error: highlightsError,
  } = useHighlights(currentFestival?.id);

  // Provide default values when no data is available
  const {
    groupPositions = [],
    totalBeers = 0,
    totalDays = 0,
    totalSpent = 0,
    totalBaseCents = 0,
    totalTipCents = 0,
  } = highlightsData || {
    groupPositions: [],
    totalBeers: 0,
    totalDays: 0,
    totalSpent: 0,
    totalBaseCents: 0,
    totalTipCents: 0,
  };

  // Convert totalSpent from cents to euros - React Compiler handles memoization automatically
  const getSpentOnBeers = () => {
    if (totalSpent > 0) {
      return (totalSpent / 100).toFixed(2);
    }
    // Fallback: calculate from beers if totalSpent is 0
    if (totalBeers > 0) {
      const beerCost = getDefaultBeerCost(currentFestival);
      return (totalBeers * beerCost).toFixed(2);
    }
    return null;
  };
  const spentOnBeers = getSpentOnBeers();

  // Show loading state
  if (festivalLoading || highlightsLoading) {
    return <SkeletonHighlights />;
  }

  // Handle error state silently - just show empty state
  if (
    highlightsError ||
    (groupPositions.length === 0 && totalBeers === 0 && totalDays === 0)
  ) {
    return null;
  }

  // Determine grid columns based on user stats
  const gridCols =
    groupPositions.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";

  return (
    <Card className="min-h-[140px] rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold">
          {t("home.highlights")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-4", gridCols)}>
          {groupPositions.length > 0 && (
            <div className="rounded-lg bg-green-50 p-4 shadow-sm">
              <CardDescription className="mb-2 font-semibold">
                {t("home.topGroups")}
              </CardDescription>
              <ul>
                {groupPositions.map(
                  (group: { groupId: string; groupName: string }) => (
                    <li key={group.groupId}>
                      <Button asChild variant="link" className="underline">
                        <Link href={`/groups/${group.groupId}`}>
                          {group.groupName}
                        </Link>
                      </Button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          {(totalBeers > 0 || totalDays > 0) && (
            <div className="rounded-lg bg-blue-50 p-4 shadow-sm">
              <CardDescription className="mb-2 font-semibold">
                {t("home.stats")}
              </CardDescription>
              <ul className="text-sm">
                {totalDays > 0 && (
                  <li className="mb-2">
                    {t("home.wentTimes", { count: totalDays })}
                  </li>
                )}
                {totalBeers > 0 && (
                  <li className="mb-2">
                    {t("home.hadBeers", { count: totalBeers })}
                  </li>
                )}
                {spentOnBeers && (
                  <li className="mb-2">
                    {t("home.spentOnBeers", { amount: spentOnBeers })}
                    {(totalBaseCents > 0 || totalTipCents > 0) && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({t("home.baseCost")}: €
                        {(totalBaseCents / 100).toFixed(0)} | {t("home.tips")}:
                        €{(totalTipCents / 100).toFixed(0)})
                      </span>
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Highlights;
