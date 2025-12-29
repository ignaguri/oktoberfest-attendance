"use client";

import { AchievementGrid } from "@/components/achievements/AchievementGrid";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import {
  getUserAchievements,
  getUserAchievementStats,
} from "@/lib/actions/achievements";
import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";

import type {
  AchievementWithProgress,
  AchievementStats,
  AchievementCategory,
} from "@/lib/types/achievements";

export default function AchievementsPage() {
  const { currentFestival } = useFestival();
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>(
    [],
  );
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | AchievementCategory>(
    "all",
  );

  useEffect(() => {
    const fetchAchievements = async () => {
      if (!currentFestival) return;

      setIsLoading(true);
      try {
        const [achievementsData, statsData] = await Promise.all([
          getUserAchievements(currentFestival.id),
          getUserAchievementStats(currentFestival.id),
        ]);

        setAchievements(achievementsData);
        setStats(statsData);
      } catch (error) {
        logger.error(
          "Error fetching achievements",
          logger.clientComponent("AchievementsPage", {
            festivalId: currentFestival?.id,
          }),
          error as Error,
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAchievements();
  }, [currentFestival]);

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
        <h1 className="text-3xl font-bold mb-2">🎖️ Achievements</h1>
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
                {Math.round(
                  (stats.unlocked_achievements / stats.total_achievements) *
                    100,
                )}
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
                  ([rarity, data]) => (
                    <div
                      key={rarity}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">{rarity}:</span>
                      <span className="font-medium">
                        {data.unlocked}/{data.total}
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
                  .filter(([_, data]) => data.total > 0)
                  .slice(0, 3)
                  .map(([category, data]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">{category}:</span>
                      <span className="font-medium">
                        {data.unlocked}/{data.total}
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
              <h3 className="text-lg font-medium text-green-700">
                ✅ Completed
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
                🎯 In Progress
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
