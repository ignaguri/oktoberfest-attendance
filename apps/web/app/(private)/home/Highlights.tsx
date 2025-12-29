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
import { useUserHighlights } from "@/lib/data";
import { getDefaultBeerCost } from "@/lib/festivalConstants";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import { useMemo } from "react";

const Highlights = () => {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    data: highlightsData,
    loading: highlightsLoading,
    error: highlightsError,
  } = useUserHighlights(currentFestival?.id);

  // Provide default values when no data is available
  const {
    topPositions = [],
    totalBeers = 0,
    daysAttended = 0,
    custom_beer_cost,
  } = highlightsData || {
    topPositions: [],
    totalBeers: 0,
    daysAttended: 0,
    custom_beer_cost: getDefaultBeerCost(currentFestival),
  };

  const spentOnBeers = useMemo(() => {
    if (totalBeers > 0) {
      const beerCost = custom_beer_cost || getDefaultBeerCost(currentFestival);
      return (totalBeers * beerCost).toFixed(2);
    }
  }, [totalBeers, custom_beer_cost, currentFestival]);

  // Show loading state
  if (festivalLoading || highlightsLoading) {
    return <SkeletonHighlights />;
  }

  // Handle error state silently - just show empty state
  if (
    highlightsError ||
    (topPositions.length === 0 && totalBeers === 0 && daysAttended === 0)
  ) {
    return null;
  }

  // Determine grid columns based on user stats
  const gridCols =
    topPositions.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";

  return (
    <Card className="shadow-lg rounded-lg border border-gray-200 min-h-[140px]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center">
          Highlights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-4", gridCols)}>
          {topPositions.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg shadow-sm">
              <CardDescription className="font-semibold mb-2">
                👑 You&apos;re in the top 3 of these groups:
              </CardDescription>
              <ul>
                {topPositions.map((group) => (
                  <li key={group.group_id}>
                    <Button asChild variant="link" className="underline">
                      <Link href={`/groups/${group.group_id}`}>
                        {group.group_name}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(totalBeers > 0 || daysAttended > 0) && (
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
              <CardDescription className="font-semibold mb-2">
                🍻 Stats 📊
              </CardDescription>
              <ul className="text-sm">
                {daysAttended > 0 && (
                  <li className="mb-2">
                    You went <strong>{daysAttended}</strong> times
                  </li>
                )}
                {totalBeers > 0 && (
                  <li className="mb-2">
                    You had <strong>{totalBeers}</strong> beers
                  </li>
                )}
                {totalBeers > 0 && (
                  <li>
                    You&apos;ve spent <strong>~€{spentOnBeers}</strong> on beers
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
