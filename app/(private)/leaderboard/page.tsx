import { Suspense } from "react";
import GlobalLeaderboardClient from "./GlobalLeaderboardClient";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function GlobalLeaderboardPage() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Global Leaderboard</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <GlobalLeaderboardClient />
      </Suspense>
    </div>
  );
}
