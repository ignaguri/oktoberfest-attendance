import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import QRButton from "@/components/QR/QRButton";
import ShareButton from "@/components/ShareButton/ShareButton";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/utils/supabase/server";
import { CalendarDays, Images } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";
import { Suspense } from "react";

import type { WinningCriteria } from "@/lib/types";

import { JoinGroupForm } from "../JoinGroupForm";

async function getAuthHeaders() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  };
}

// Get the full API URL for server-side fetch
async function getServerApiUrl() {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3008";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}/api`;
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  const authHeaders = await getAuthHeaders();
  const apiBase = await getServerApiUrl();

  // Fetch group and leaderboard in parallel
  const [groupRes, leaderboardRes] = await Promise.all([
    fetch(`${apiBase}/v1/groups/${groupId}`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiBase}/v1/groups/${groupId}/leaderboard`, {
      headers: authHeaders,
      cache: "no-store",
    }),
  ]);

  if (!groupRes.ok) {
    redirect("/groups");
  }

  const group = await groupRes.json();
  const leaderboardResponse = await leaderboardRes.json();
  const isMember = group.isMember ?? false;

  if (!isMember) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="mb-4 text-2xl font-bold">
          Join Group &quot;{group.name}&quot;
        </h2>
        <JoinGroupForm groupName={group.name} groupId={group.id} />
      </div>
    );
  }

  // Transform API response to match Leaderboard component expectations
  type LeaderboardEntry = {
    userId: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    daysAttended: number;
    totalBeers: number;
    avgBeers: number;
  };
  const leaderboardEntries = leaderboardResponse.data.map(
    (entry: LeaderboardEntry, index: number) => ({
      userId: entry.userId,
      username: entry.username,
      fullName: entry.fullName,
      avatarUrl: entry.avatarUrl,
      daysAttended: entry.daysAttended,
      totalBeers: entry.totalBeers,
      avgBeers: entry.avgBeers,
      position: index + 1,
    }),
  );

  const t = getTranslations();

  return (
    <div className="w-full max-w-lg">
      <Suspense fallback={<LoadingSpinner />}>
        <div className="mb-4 flex items-center justify-center">
          <h2 className="grow pr-2 text-center text-3xl font-bold">
            Group &quot;{group.name}&quot;
          </h2>
          <ShareButton groupName={group.name} groupId={group.id} />
        </div>

        {group.description && (
          <p className="mb-4 text-gray-600">{group.description}</p>
        )}

        <p className="mb-4 text-sm font-medium text-gray-500">
          Winning Criteria:{" "}
          {t(`groups.winningCriteria.${group.winningCriteria}`)}
        </p>

        <div className="flex flex-col gap-4">
          <Leaderboard
            entries={leaderboardEntries}
            winningCriteria={group.winningCriteria as WinningCriteria}
            showGroupCount={false}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href={`/groups/${groupId}/calendar`}>
                  <CalendarDays size={24} />
                  <span className="ml-2">Calendar</span>
                </Link>
              </Button>
              <Button asChild variant="yellow">
                <Link href={`/groups/${groupId}/gallery`}>
                  <Images size={24} />
                  <span className="ml-2">Gallery</span>
                </Link>
              </Button>
              {/* Location sharing feature disabled - requires migration from deprecated tables
                  (user_locations, location_sharing_preferences) to session-based model.
                  See: app/api/location-sharing/ for migration notes */}
            </div>
            <Button asChild variant="darkYellow">
              <Link href={`/group-settings/${groupId}`}>Group Settings</Link>
            </Button>
            <div className="flex items-center gap-2">
              <QRButton groupName={group.name} groupId={group.id} withText />
              <ShareButton groupName={group.name} groupId={group.id} withText />
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
