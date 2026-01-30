import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Map } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  LocationMapModal,
  LocationSharingToggle,
  TentProximityBanner,
} from "@/components/location";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { AppHeader } from "@/components/shared/app-header";
import { FestivalStatus } from "@/components/shared/festival-status";
import { MapLinkButton } from "@/components/shared/map-link-button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";
import { useLocationContextSafe } from "@/lib/location";
import { logger } from "@/lib/logger";
import { useQuickAttendance } from "@/lib/quick-attendance";

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
  const { t } = useTranslation();
  const { currentFestival } = useFestival(); // Ensure festival context is initialized
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Location state (safe hook works outside provider too)
  const { isSharing, nearbyMembers } = useLocationContextSafe();

  // Quick attendance context for opening FAB with preselected tent
  const { openSheet } = useQuickAttendance();

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["attendanceByDate"] });
      await queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
      await queryClient.invalidateQueries({ queryKey: ["attendances"] });
    } catch (error) {
      logger.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const handleTentCheckIn = useCallback(
    (tentId: string, tentName: string) => {
      // Close the map modal and open the quick attendance sheet with preselected tent
      setShowMapModal(false);
      // Small delay to allow modal close animation before opening sheet
      setTimeout(() => {
        openSheet({ tentId, tentName });
      }, 150);
    },
    [openSheet],
  );

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={["top"]}>
      {/* Tent Proximity Banner - shows at top when near a tent */}
      {Platform.OS !== "web" && (
        <TentProximityBanner onCheckIn={handleTentCheckIn} threshold={50} />
      )}

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

          {/* Location Sharing Card (native only) */}
          {Platform.OS !== "web" && currentFestival?.id && (
            <Card size="md" variant="elevated" className="p-3">
              <HStack className="items-center justify-between">
                <LocationSharingToggle
                  festivalId={currentFestival.id}
                  compact
                />
                <Pressable
                  onPress={() => setShowMapModal(true)}
                  className="flex-row items-center gap-2 rounded-lg bg-primary-500 px-3 py-2"
                  accessibilityLabel="Open festival map"
                >
                  <Map size={18} color={Colors.white} />
                  <Text className="text-sm font-medium text-white">
                    {t("location.map.button")}
                  </Text>
                  {isSharing && nearbyMembers.length > 0 && (
                    <View className="ml-1 rounded-full bg-white px-2 py-0.5">
                      <Text className="text-xs font-bold text-primary-600">
                        {nearbyMembers.length}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </HStack>
            </Card>
          )}

          {/* Map Link Button (only shows if festival has mapUrl) */}
          <MapLinkButton />

          {/* Activity Feed */}
          <ActivityFeed onRefresh={handleRefresh} />
        </VStack>
      </ScrollView>

      {/* Full-screen Map Modal */}
      {Platform.OS !== "web" && currentFestival?.id && (
        <LocationMapModal
          visible={showMapModal}
          onClose={() => setShowMapModal(false)}
          festivalId={currentFestival.id}
          onTentSelect={handleTentCheckIn}
        />
      )}
    </SafeAreaView>
  );
}
