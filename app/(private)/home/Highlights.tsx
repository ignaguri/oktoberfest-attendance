import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { fetchHighlights } from "@/lib/actions";
import { COST_PER_BEER } from "@/lib/constants";
import { cn } from "@/lib/utils";

import "server-only";

const Highlights = async () => {
  const { topPositions, totalBeers, daysAttended } = await fetchHighlights();

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
            <div className="bg-green-50 p-4 rounded-lg shadow">
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
            <div className="bg-blue-50 p-4 rounded-lg shadow">
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
                    You have spent{" "}
                    <strong>~€{totalBeers * COST_PER_BEER}</strong> on beers
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
