import { useFestival } from "@prostcounter/shared/contexts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityFeed } from "@/components/shared/activity-feed";
import { AppHeader } from "@/components/shared/app-header";
import { FestivalStatus } from "@/components/shared/festival-status";
import { MapLinkButton } from "@/components/shared/map-link-button";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

/**
 * Home screen displaying:
 * - Festival status (countdown/current day/ended)
 * - Map link button (if festival has map URL)
 * - Activity feed showing all user activities
 *
 * Quick attendance is now available via the FAB (Floating Action Button)
 * on all tabs.
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
    <SafeAreaView className="bg-background-50 flex-1" edges={["top"]}>
      <ScrollView
        className="flex-1"
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
          {/* App Header with logo and name */}
          <AppHeader />

          {/* Festival Status */}
          <FestivalStatus />

          {/* Map Link Button (only shows if festival has mapUrl) */}
          <MapLinkButton />

          {/* Activity Feed */}
          <ActivityFeed onRefresh={handleRefresh} />
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
