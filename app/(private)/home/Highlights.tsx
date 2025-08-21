"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { COST_PER_BEER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { fetchHighlights } from "./actions";

type HighlightsData = {
  topPositions: { group_id: string; group_name: string }[];
  totalBeers: number;
  daysAttended: number;
  custom_beer_cost: number;
};

const Highlights = () => {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const [highlightsData, setHighlightsData] = useState<HighlightsData>({
    topPositions: [],
    totalBeers: 0,
    daysAttended: 0,
    custom_beer_cost: COST_PER_BEER,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHighlights = async () => {
      if (!currentFestival) {
        setHighlightsData({
          topPositions: [],
          totalBeers: 0,
          daysAttended: 0,
          custom_beer_cost: COST_PER_BEER,
        });
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchHighlights(currentFestival.id);
        setHighlightsData(data);
      } catch (error) {
        console.error("Error fetching highlights:", error);
        setHighlightsData({
          topPositions: [],
          totalBeers: 0,
          daysAttended: 0,
          custom_beer_cost: COST_PER_BEER,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadHighlights();
  }, [currentFestival]);

  if (festivalLoading || isLoading) {
    return (
      <Card className="shadow-lg rounded-lg border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center">
            Highlights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-600">Loading highlights...</p>
        </CardContent>
      </Card>
    );
  }

  const { topPositions, totalBeers, daysAttended, custom_beer_cost } =
    highlightsData;

  if (topPositions.length === 0 && totalBeers === 0 && daysAttended === 0) {
    return null;
  }

  // Determine grid columns based on user stats
  const gridCols =
    topPositions.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";

  return (
    <Card className="shadow-lg rounded-lg border border-gray-200">
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
                    You&apos;ve spent{" "}
                    <strong>
                      ~€
                      {(
                        totalBeers * (custom_beer_cost || COST_PER_BEER)
                      ).toFixed(2)}
                    </strong>{" "}
                    on beers
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
