import LoadingSpinner from "@/components/LoadingSpinner";
import { getTranslations } from "@/lib/i18n/server";
import { Suspense } from "react";

import GlobalLeaderboardClient from "./GlobalLeaderboardClient";

export default function GlobalLeaderboardPage() {
  const t = getTranslations();

  return (
    <div className="mx-auto max-w-sm p-2 sm:max-w-lg md:max-w-xl lg:max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t("leaderboard.globalTitle")}</h1>
      </div>
      <Suspense fallback={<LoadingSpinner />}>
        <GlobalLeaderboardClient />
      </Suspense>
    </div>
  );
}
