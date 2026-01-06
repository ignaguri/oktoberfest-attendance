"use client";

import { AchievementGrid } from "@/components/achievements/AchievementGrid";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { useAchievementsWithProgress } from "@/hooks/useAchievements";
import { useTranslation } from "@/lib/i18n/client";
import { useState } from "react";

import type { AchievementCategory } from "@prostcounter/shared/schemas";

export default function AchievementsPage() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data, loading: isLoading } = useAchievementsWithProgress(
    currentFestival?.id,
  );
  const [activeTab, setActiveTab] = useState<"all" | AchievementCategory>(
    "all",
  );

  const achievements = data?.data || [];
  const stats = data?.stats;

  const filteredAchievements =
    activeTab === "all"
      ? achievements
      : achievements.filter((a) => a.category === activeTab);

  const unlockedAchievements = filteredAchievements.filter(
    (a) => a.is_unlocked,
  );
  const lockedAchievements = filteredAchievements.filter((a) => !a.is_unlocked);

  if (!currentFestival) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {t("achievements.pageTitle")}
          </h1>
          <p className="text-gray-600">{t("achievements.selectFestival")}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">
            {t("achievements.pageTitle")}
          </h1>
          <p className="text-gray-600">{t("common.status.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          {t("achievements.pageTitle")}
        </h1>
        <p className="text-gray-600">
          {t("achievements.trackProgress", { festival: currentFestival.name })}
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.totalProgress")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">
                {stats.unlocked_achievements} / {stats.total_achievements}
              </div>
              <p className="text-sm text-gray-600">
                {t("achievements.stats.percentUnlocked", {
                  percent:
                    stats.total_achievements > 0
                      ? Math.round(
                          (stats.unlocked_achievements /
                            stats.total_achievements) *
                            100,
                        )
                      : 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.totalPoints")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total_points}
              </div>
              <p className="text-sm text-gray-600">
                {t("achievements.stats.achievementPoints")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.rarityBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {Object.entries(stats.breakdown_by_rarity).map(
                  ([rarity, rarityData]) => (
                    <div
                      key={rarity}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {t(`achievements.rarity.${rarity}`)}:
                      </span>
                      <span className="font-medium">
                        {rarityData.unlocked}/{rarityData.total}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.categories")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {Object.entries(stats.breakdown_by_category)
                  .filter(([_, catData]) => catData.total > 0)
                  .slice(0, 3)
                  .map(([category, catData]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {t(`achievements.categories.${category}`)}:
                      </span>
                      <span className="font-medium">
                        {catData.unlocked}/{catData.total}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <SingleSelect
            value={activeTab}
            buttonClassName="w-full sm:w-[200px]"
            options={[
              {
                title: t("achievements.filter.categoriesTitle"),
                options: [
                  { value: "all", label: t("achievements.filter.all") },
                  {
                    value: "consumption",
                    label: t("achievements.filter.consumption"),
                  },
                  {
                    value: "attendance",
                    label: t("achievements.filter.attendance"),
                  },
                  {
                    value: "explorer",
                    label: t("achievements.filter.explorer"),
                  },
                  { value: "social", label: t("achievements.filter.social") },
                  {
                    value: "competitive",
                    label: t("achievements.filter.competitive"),
                  },
                  { value: "special", label: t("achievements.filter.special") },
                ],
              },
            ]}
            placeholder={t("achievements.filter.selectCategory")}
            onSelect={(option) =>
              setActiveTab(option.value as typeof activeTab)
            }
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {activeTab === "all"
                ? t("achievements.filter.all")
                : t(`achievements.filter.${activeTab}`)}
            </h2>

            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 border-green-200"
              >
                {unlockedAchievements.length} {t("achievements.unlocked")}
              </Badge>
              <Badge variant="outline">
                {lockedAchievements.length} {t("achievements.locked")}
              </Badge>
            </div>
          </div>

          {unlockedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-green-700">
                {t("achievements.completed")}
              </h3>
              <AchievementGrid
                achievements={unlockedAchievements}
                showProgress={true}
              />
            </div>
          )}

          {lockedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">
                {t("achievements.inProgress")}
              </h3>
              <AchievementGrid
                achievements={lockedAchievements}
                showProgress={true}
              />
            </div>
          )}

          {filteredAchievements.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t("achievements.empty.title")}
              </h3>
              <p className="text-gray-600">
                {t("achievements.empty.description")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
