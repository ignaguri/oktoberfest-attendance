import LoadingSpinner from "@/components/LoadingSpinner";
import { FestivalSelector } from "@/components/FestivalSelector";
import { Suspense } from "react";

import GlobalLeaderboardClient from "./GlobalLeaderboardClient";

export default function GlobalLeaderboardPage() {
  return (
    <div className="max-w-sm sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto p-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Global Leaderboard</h1>
        <FestivalSelector />
      </div>
      <Suspense fallback={<LoadingSpinner />}>
        <GlobalLeaderboardClient />
      </Suspense>
    </div>
  );
}
