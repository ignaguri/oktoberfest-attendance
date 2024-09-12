import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/lib/database.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { COST_PER_BEER } from "@/lib/constants";

const fetchHighlights = async (groups: Tables<"groups">[]) => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { topPositions: [], amountOfBeers: 0, daysAttended: 0 };
  }

  const topPositions = [];
  let amountOfBeers = 0;
  let daysAttended = 0;

  for (const group of groups || []) {
    if (group && group.id) {
      const { data: leaderboardData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("group_id", group.id)
        .order(group.winning_criteria ?? "total_beers", { ascending: false })
        .limit(3);

      const userPosition = leaderboardData?.find(
        (entry) => entry.user_id === user.id,
      );
      if (userPosition) {
        topPositions.push({
          id: group.id,
          name: group.name,
        });
        amountOfBeers += userPosition.total_beers ?? 0;
        daysAttended += userPosition.days_attended ?? 0;
      }
    }
  }

  return { topPositions, amountOfBeers, daysAttended };
};

const Highlights = async ({ groups }: { groups: Tables<"groups">[] }) => {
  const { topPositions, amountOfBeers, daysAttended } =
    await fetchHighlights(groups);

  if (topPositions.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg rounded-lg border border-gray-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center">
          Highlights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <CardDescription className="font-semibold mb-2">
              👑 You&apos;re in the top 3 of these groups:
            </CardDescription>
            <ul>
              {topPositions.map((group) => (
                <li key={group.id}>
                  <Button asChild variant="link" className="underline">
                    <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <CardDescription className="font-semibold mb-2">
              🍻 Stats 📊
            </CardDescription>
            <ul className="text-sm">
              <li className="mb-2">
                You went <strong>{daysAttended}</strong> times
              </li>
              <li className="mb-2">
                You&apos;ve had <strong>{amountOfBeers}</strong> beers
              </li>
              <li>
                You have spent{" "}
                <strong>~€{amountOfBeers * COST_PER_BEER}</strong> on beers
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Highlights;
