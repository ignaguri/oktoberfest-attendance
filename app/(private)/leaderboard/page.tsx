import LoadingSpinner from "@/components/LoadingSpinner";
import { Suspense } from "react";

import GlobalLeaderboardClient from "./GlobalLeaderboardClient";

export default function GlobalLeaderboardPage() {
  return (
    <div className="max-w-sm sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto p-2">
      <h1 className="text-2xl font-bold mb-4">Global Leaderboard</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <GlobalLeaderboardClient />
      </Suspense>
    </div>
  );
}
