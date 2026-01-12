import { ActivityFeed } from "@/components/shared/activity-feed";
import { FestivalStatus } from "@/components/shared/festival-status";
import { MapLinkButton } from "@/components/shared/map-link-button";
import { QuickAttendanceCard } from "@/components/shared/quick-attendance-card";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";

/**
 * Home screen displaying:
 * - Festival status (countdown/current day/ended)
 * - Quick attendance card for logging today's beers
 * - Map link button (if festival has map URL)
 * - Activity feed showing all user activities
 *
 * Features pull-to-refresh to reload all data.
 */
export default function HomeScreen() {
  useFestival(); // Ensure festival context is initialized
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["attendanceByDate"] });
      await queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
      await queryClient.invalidateQueries({ queryKey: ["attendances"] });
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary[500]}
          colors={[Colors.primary[500]]}
        />
      }
    >
      <VStack space="md" className="p-4 pb-8">
        {/* Festival Status */}
        <FestivalStatus />

        {/* Quick Attendance Card */}
        <QuickAttendanceCard />

        {/* Map Link Button (only shows if festival has mapUrl) */}
        <MapLinkButton />

        {/* Activity Feed */}
        <ActivityFeed onRefresh={handleRefresh} />
      </VStack>
    </ScrollView>
  );
}
