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

const fetchTopPositions = async (groups: Tables<"groups">[]) => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  const topPositions = [];
  for (const group of groups || []) {
    if (group && group.id) {
      const { data: leaderboardData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("group_id", group.id)
        .order(group.winning_criteria ?? "total_beers", { ascending: false })
        .limit(1);

      if (leaderboardData && leaderboardData[0]?.user_id === user.id) {
        topPositions.push({
          id: group.id,
          name: group.name ?? "Unknown Group",
        });
      }
    }
  }

  return topPositions;
};

const Highlights = async ({ groups }: { groups: Tables<"groups">[] }) => {
  const topPositions = await fetchTopPositions(groups);

  if (topPositions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>👑 You&apos;re #1 in these groups:</CardDescription>
        <ul>
          {topPositions.map((group) => (
            <li key={group.id}>
              <Button asChild variant="link">
                <Link href={`/groups/${group.id}`}>{group.name}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default Highlights;
