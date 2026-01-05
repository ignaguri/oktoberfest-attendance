"use client";

import { AchievementGrid } from "@/components/achievements/AchievementGrid";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { useAchievementsWithProgress } from "@/hooks/useAchievements";
import { useState } from "react";

import type { AchievementCategory } from "@prostcounter/shared/schemas";

export default function AchievementsPage() {
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
          <h1 className="text-2xl font-bold mb-4">Achievements</h1>
          <p className="text-gray-600">
            Please select a festival to view achievements.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Achievements</h1>
          <p className="text-gray-600">Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Achievements</h1>
        <p className="text-gray-600">
          Track your progress and unlock achievements at {currentFestival.name}
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">
                {stats.unlocked_achievements} / {stats.total_achievements}
              </div>
              <p className="text-sm text-gray-600">
                {stats.total_achievements > 0
                  ? Math.round(
                      (stats.unlocked_achievements / stats.total_achievements) *
                        100,
                    )
                  : 0}
                % unlocked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Points
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total_points}
              </div>
              <p className="text-sm text-gray-600">Achievement points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Rarity Breakdown
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
                      <span className="capitalize">{rarity}:</span>
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
                Categories
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
                      <span className="capitalize">{category}:</span>
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
                title: "Achievement Categories",
                options: [
                  { value: "all", label: "All Achievements" },
                  { value: "consumption", label: "Beer Achievements" },
                  { value: "attendance", label: "Days Achievements" },
                  { value: "explorer", label: "Tents Achievements" },
                  { value: "social", label: "Social Achievements" },
                  { value: "competitive", label: "Compete Achievements" },
                  { value: "special", label: "Special Achievements" },
                ],
              },
            ]}
            placeholder="Select category"
            onSelect={(option) => setActiveTab(option.value as any)}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {activeTab === "all"
                ? "All Achievements"
                : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Achievements`}
            </h2>

            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 border-green-200"
              >
                {unlockedAchievements.length} Unlocked
              </Badge>
              <Badge variant="outline">
                {lockedAchievements.length} Locked
              </Badge>
            </div>
          </div>

          {unlockedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-green-700">Completed</h3>
              <AchievementGrid
                achievements={unlockedAchievements}
                showProgress={true}
              />
            </div>
          )}

          {lockedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">In Progress</h3>
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
                No achievements in this category
              </h3>
              <p className="text-gray-600">
                Try a different category or start participating to unlock
                achievements!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
