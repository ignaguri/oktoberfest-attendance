"use client";

import Avatar from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfilePreview } from "@/components/ui/profile-preview";
import { SkeletonLeaderboard } from "@/components/ui/skeleton-cards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFestival } from "@/contexts/FestivalContext";
import { useGlobalLeaderboard } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { Link } from "next-view-transitions";

import type { LeaderboardEntry } from "@prostcounter/shared";

// Configurable constant for easy modification
const LEADERBOARD_PREVIEW_LIMIT = 3;

const getDisplayName = ({
  username,
  full_name,
}: {
  username?: string | null;
  full_name?: string | null;
}) => {
  if (username) {
    return username;
  }
  if (full_name) {
    return full_name;
  }
  return "No name";
};

const LeaderboardPreview = () => {
  const { currentFestival, isLoading: festivalLoading } = useFestival();

  // Use default winning criteria (days_attended = ID 1)
  const {
    data: leaderboardData,
    loading: leaderboardLoading,
    error: leaderboardError,
  } = useGlobalLeaderboard(1, currentFestival?.id);

  // Show loading state
  if (festivalLoading || leaderboardLoading) {
    return <SkeletonLeaderboard />;
  }

  // Handle error state silently - just show empty state
  if (leaderboardError || !leaderboardData || leaderboardData.length === 0) {
    return null;
  }

  // Get top users (already sorted by the server)
  const topUsers = leaderboardData.slice(0, LEADERBOARD_PREVIEW_LIMIT);

  return (
    <Card className="min-h-[280px] rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold">
          🏆 Global Leaderboard
        </CardTitle>
        <CardDescription className="text-center">
          Top {LEADERBOARD_PREVIEW_LIMIT} performers
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <div className="flex flex-col gap-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Crown className="text-yellow-500" size={16} />
                      <span>Days</span>
                    </div>
                  </TableHead>
                  <TableHead>Liters</TableHead>
                  <TableHead>Avg.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.map((user: LeaderboardEntry, index: number) => (
                  <TableRow
                    key={user.userId}
                    className={cn(
                      index % 2 === 0 ? "bg-white" : "bg-gray-50",
                      index === 0 && "bg-yellow-50", // Highlight first place
                    )}
                  >
                    <TableCell className="font-bold">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                    </TableCell>
                    <TableCell className="w-full max-w-[min(200px,35vw)]">
                      <ProfilePreview
                        username={user.username || "Unknown"}
                        fullName={user.fullName}
                        avatarUrl={user.avatarUrl}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar
                            url={user.avatarUrl}
                            fallback={{
                              username: user.username,
                              full_name: user.fullName,
                              email: "no.name@email.com",
                            }}
                            size="small"
                          />
                          <span className="truncate font-medium">
                            {getDisplayName({
                              username: user.username,
                              full_name: user.fullName,
                            })}
                          </span>
                        </div>
                      </ProfilePreview>
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.daysAttended}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.totalBeers} 🍺
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.avgBeers?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center">
            <Button asChild variant="outline" className="w-fit">
              <Link href="/leaderboard">View Full Leaderboard</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaderboardPreview;
