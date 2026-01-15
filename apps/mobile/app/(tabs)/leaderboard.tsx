import { Leaderboard, type SortOrder } from "@/components/shared/leaderboard";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useGlobalLeaderboard } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { Award, ChevronRight, Trophy } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import type { WinningCriteria } from "@prostcounter/shared/schemas";

// Map WinningCriteria to API criteria IDs
const CRITERIA_TO_ID: Record<WinningCriteria, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

/**
 * Global Leaderboard screen
 *
 * Features:
 * - Sortable columns (tap header to change sort)
 * - Pull-to-refresh
 * - Current user highlighting
 * - Loading/error/empty states
 */
export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const router = useRouter();

  // Sort state - default to total_beers, descending
  const [sortBy, setSortBy] = useState<WinningCriteria>("total_beers");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch leaderboard data
  const {
    data,
    loading,
    error,
    refetch,
    isRefetching = false,
  } = useGlobalLeaderboard(CRITERIA_TO_ID[sortBy], currentFestival?.id);

  // Ensure entries is always an array (data can be null)
  const entries = data ?? [];

  // Handle sort change (column and direction)
  const handleSortChange = useCallback(
    (criteria: WinningCriteria, order: SortOrder) => {
      setSortBy(criteria);
      setSortOrder(order);
    },
    [],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state (initial or festival loading)
  if (festivalLoading || (loading && entries.length === 0)) {
    return (
      <ScrollView className="flex-1 bg-background-50">
        <VStack space="md" className="items-center justify-center p-4 py-20">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-typography-500">
            {t("leaderboard.loading", {
              defaultValue: "Loading leaderboard...",
            })}
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
            <Trophy size={48} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("leaderboard.noFestival", {
                defaultValue: "No festival selected",
              })}
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    );
  }

  // Error state
  if (error && entries.length === 0) {
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
            <Trophy size={48} color={IconColors.error} />
            <Text className="mt-2 text-center text-error-600">
              {t("leaderboard.error", {
                defaultValue: "Failed to load leaderboard",
              })}
            </Text>
            <Text className="mt-1 text-center text-sm text-typography-400">
              {t("common.actions.pullToRefresh", {
                defaultValue: "Pull to refresh",
              })}
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
      <VStack space="md" className="p-4 pb-8">
        {/* Achievements Section */}
        <Pressable
          onPress={() => router.push("/achievements")}
          className="rounded-xl bg-primary-100 px-4 py-4"
          accessibilityLabel={t("achievements.viewMyAchievements", {
            defaultValue: "See my achievements",
          })}
          accessibilityRole="button"
        >
          <HStack className="items-center justify-between">
            <HStack space="md" className="items-center">
              <Box className="rounded-full bg-primary-200 p-2">
                <Award size={24} color={Colors.primary[600]} />
              </Box>
              <VStack>
                <Text className="text-base font-semibold text-primary-800">
                  {t("achievements.viewMyAchievements", {
                    defaultValue: "See my achievements",
                  })}
                </Text>
                <Text className="text-sm text-primary-600">
                  {t("achievements.viewProgress", {
                    defaultValue: "View your progress and unlocked badges",
                  })}
                </Text>
              </VStack>
            </HStack>
            <ChevronRight size={24} color={Colors.primary[600]} />
          </HStack>
        </Pressable>

        {/* Divider */}
        <View className="my-1 h-px bg-outline-200" />

        {/* Leaderboard Section Header */}
        <HStack space="sm" className="items-center">
          <Trophy size={24} color={Colors.primary[500]} />
          <Heading size="lg" className="text-typography-900">
            {t("leaderboard.festivalLeaderboard", {
              defaultValue: "{{festivalName}} Leaderboard",
              festivalName: currentFestival.name,
            })}
          </Heading>
        </HStack>

        {/* Leaderboard with sortable columns */}
        <Leaderboard
          entries={entries}
          winningCriteria={sortBy}
          currentUserId={user?.id}
          sortable
          activeSortColumn={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          emptyMessage={t("leaderboard.empty", {
            defaultValue: "No entries yet. Be the first to log a beer!",
          })}
        />
      </VStack>
    </ScrollView>
  );
}
