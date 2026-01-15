import { AchievementCard } from "@/components/achievements/achievement-card";
import { AchievementStatsSummary } from "@/components/achievements/achievement-stats-summary";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useAchievementsWithProgress } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Award } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView } from "react-native";

import type { AchievementWithProgress } from "@prostcounter/shared/schemas";

/**
 * Achievements screen showing user's achievement progress
 *
 * Features:
 * - Stats summary (unlocked/total, percentage, points)
 * - Completed achievements section
 * - In Progress achievements section
 * - Pull-to-refresh
 */
export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();

  // Fetch achievements with progress
  const {
    data: achievementsResponse,
    loading,
    error,
    refetch,
    isRefetching = false,
  } = useAchievementsWithProgress(currentFestival?.id);

  // Parse achievements and stats from response
  const achievements = useMemo(() => {
    return (achievementsResponse?.data || []) as AchievementWithProgress[];
  }, [achievementsResponse]);

  const stats = useMemo(() => {
    return achievementsResponse?.stats || null;
  }, [achievementsResponse]);

  // Split into unlocked and locked
  const unlockedAchievements = useMemo(() => {
    return achievements.filter((a) => a.is_unlocked);
  }, [achievements]);

  const lockedAchievements = useMemo(() => {
    return achievements.filter((a) => !a.is_unlocked);
  }, [achievements]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state (initial or festival loading)
  if (festivalLoading || (loading && achievements.length === 0)) {
    return (
      <ScrollView className="flex-1 bg-background-50">
        <VStack space="md" className="items-center justify-center p-4 py-20">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-typography-500">
            {t("achievements.loading")}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  // No festival selected
  if (!currentFestival) {
    return (
      <ScrollView className="flex-1 bg-background-50">
        <VStack space="md" className="p-4">
          <Card
            variant="outline"
            size="md"
            className="items-center bg-white p-6"
          >
            <Award size={48} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("achievements.noFestival")}
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    );
  }

  // Error state
  if (error && achievements.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.primary[500]}
            colors={[Colors.primary[500]]}
          />
        }
      >
        <VStack space="md" className="p-4">
          <Card
            variant="outline"
            size="md"
            className="items-center bg-white p-6"
          >
            <Award size={48} color={IconColors.error} />
            <Text className="mt-2 text-center text-error-600">
              {t("achievements.error")}
            </Text>
            <Text className="mt-1 text-center text-sm text-typography-400">
              {t("common.actions.pullToRefresh")}
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={Colors.primary[500]}
          colors={[Colors.primary[500]]}
        />
      }
    >
      <VStack space="lg" className="p-4 pb-8">
        {/* Stats Summary */}
        {stats && <AchievementStatsSummary stats={stats} />}

        {/* Completed Section */}
        {unlockedAchievements.length > 0 && (
          <VStack space="sm">
            <Heading size="md" className="text-green-700">
              {t("achievements.completed")} ({unlockedAchievements.length})
            </Heading>
            <VStack space="sm">
              {unlockedAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
            </VStack>
          </VStack>
        )}

        {/* In Progress Section */}
        {lockedAchievements.length > 0 && (
          <VStack space="sm">
            <Heading size="md" className="text-typography-700">
              {t("achievements.inProgress")} ({lockedAchievements.length})
            </Heading>
            <VStack space="sm">
              {lockedAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  showProgress
                />
              ))}
            </VStack>
          </VStack>
        )}

        {/* Empty State */}
        {achievements.length === 0 && (
          <Card
            variant="outline"
            size="md"
            className="items-center bg-white p-6"
          >
            <Award size={48} color={IconColors.muted} />
            <Text className="mt-2 text-center text-typography-500">
              {t("achievements.empty")}
            </Text>
          </Card>
        )}
      </VStack>
    </ScrollView>
  );
}
