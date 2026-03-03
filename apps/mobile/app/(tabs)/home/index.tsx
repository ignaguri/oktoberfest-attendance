import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import { Map } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CrowdReportFab,
  CrowdReportPrompt,
  CrowdStatusSummary,
} from "@/components/crowd";
import {
  LocationSharingToggle,
  TentProximityBanner,
} from "@/components/location";
import { AppHeader } from "@/components/shared/app-header";
import { FestivalStatus } from "@/components/shared/festival-status";
import { UnifiedFeed } from "@/components/shared/unified-feed";
import { HomeSkeleton } from "@/components/skeletons";
import { TutorialTarget } from "@/components/tutorial";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";
import {
  useAdaptedAttendanceByDate,
  useAdaptedTents,
  useSyncRefresh,
} from "@/lib/database/adapted-hooks";
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
  const router = useRouter();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const queryClient = useQueryClient();
  const { syncAndRefresh, isSyncing } = useSyncRefresh();

  // Location state (safe hook works outside provider too)
  const { isSharing, nearbyMembers } = useLocationContextSafe();

  // Quick attendance context (for crowd report prompt after save)
  const { pendingCrowdReport, setPendingCrowdReport } = useQuickAttendance();

  // Crowd report prompt state
  const [showCrowdPrompt, setShowCrowdPrompt] = useState(false);
  const [crowdPromptTents, setCrowdPromptTents] = useState<
    { id: string; name: string }[]
  >([]);

  // Today's date for querying attendance (recalculated on screen focus to handle midnight rollover)
  const [today, setToday] = useState(() => format(new Date(), "yyyy-MM-dd"));
  useFocusEffect(
    useCallback(() => {
      setToday(format(new Date(), "yyyy-MM-dd"));
    }, []),
  );
  const festivalId = currentFestival?.id || "";

  // Fetch today's attendance to know which tents the user visited (offline-first)
  const { data: todayAttendance } = useAdaptedAttendanceByDate(
    festivalId,
    today,
  );

  // Fetch tent data for name lookup (offline-first)
  const { tents: tentGroups } = useAdaptedTents(festivalId);

  // Resolve tent IDs to { id, name } pairs
  const resolveTentNames = useCallback(
    (tentIds: string[]): { id: string; name: string }[] => {
      const allOptions = tentGroups.flatMap((group) => group.options);
      return tentIds
        .map((id) => {
          const option = allOptions.find((opt) => opt.value === id);
          return option ? { id, name: option.label } : null;
        })
        .filter((t): t is { id: string; name: string } => t !== null);
    },
    [tentGroups],
  );

  // Today's visited tents (for the crowd FAB)
  const todayVisitedTents = useMemo(() => {
    const tentIds = todayAttendance?.tentIds ?? [];
    if (tentIds.length === 0) return [];
    return resolveTentNames(tentIds);
  }, [todayAttendance?.tentIds, resolveTentNames]);

  // Handle pending crowd report from QuickAttendanceSheet
  const crowdPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (crowdPromptTimerRef.current) {
        clearTimeout(crowdPromptTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingCrowdReport || pendingCrowdReport.tentIds.length === 0) return;

    const resolved = resolveTentNames(pendingCrowdReport.tentIds);
    // Consume immediately so we don't re-trigger
    setPendingCrowdReport(null);

    if (resolved.length > 0) {
      // Small delay so the quick attendance sheet close animation finishes.
      // Defer state updates to avoid synchronous setState in effect.
      crowdPromptTimerRef.current = setTimeout(() => {
        crowdPromptTimerRef.current = null;
        setCrowdPromptTents(resolved);
        setShowCrowdPrompt(true);
      }, 500);
    }
  }, [pendingCrowdReport, resolveTentNames, setPendingCrowdReport]);

  // Handle crowd FAB press
  const handleCrowdFabPress = useCallback(() => {
    if (todayVisitedTents.length === 0) return;
    setCrowdPromptTents(todayVisitedTents);
    setShowCrowdPrompt(true);
  }, [todayVisitedTents]);

  // Handle crowd prompt close
  const handleCrowdPromptClose = useCallback(() => {
    setShowCrowdPrompt(false);
    setCrowdPromptTents([]);
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    try {
      // Sync local SQLite from API, then invalidate local query caches
      await syncAndRefresh();
      // Also invalidate API-only queries (activity feed, crowd status, messages)
      await queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
      await queryClient.invalidateQueries({ queryKey: ["crowd-status"] });
      await queryClient.invalidateQueries({ queryKey: ["message-feed"] });
    } catch (error) {
      logger.error("Failed to refresh:", error);
    }
  }, [syncAndRefresh, queryClient]);

  // Loading state - show skeleton while festival is loading
  if (festivalLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background-50" edges={["top"]}>
        <ScrollView className="flex-1">
          <VStack space="md" className="p-4 pb-20">
            <AppHeader />
            <HomeSkeleton />
          </VStack>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={["top"]}>
      {/* Tent Proximity Banner - shows at top when near a tent */}
      {Platform.OS !== "web" && <TentProximityBanner threshold={50} />}

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary[500]}
            colors={[Colors.primary[500]]}
          />
        }
      >
        <VStack space="md" className="p-4 pb-20">
          {/* App Header with logo and name */}
          <AppHeader />

          {/* Festival Status */}
          <TutorialTarget stepId="festival-status">
            <FestivalStatus />
          </TutorialTarget>

          {/* Wrapped CTA - hidden for now */}
          {/* <WrappedCTA /> */}

          {/* Location Sharing Card (native only) */}
          {Platform.OS !== "web" && currentFestival?.id && (
            <TutorialTarget stepId="location-sharing">
              <Card size="md" variant="elevated" className="p-3">
                <HStack className="items-center justify-between">
                  <LocationSharingToggle
                    festivalId={currentFestival.id}
                    compact
                  />
                  <Pressable
                    onPress={() => router.push("/map")}
                    className="flex-row items-center gap-2 rounded-lg bg-primary-500 px-3 py-2"
                    accessibilityLabel={t("location.map.openAccessibility")}
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
            </TutorialTarget>
          )}

          {/* Crowd Status Summary */}
          {currentFestival?.id && (
            <CrowdStatusSummary festivalId={currentFestival.id} />
          )}

          {/* Unified Feed (activities + messages interleaved) */}
          <TutorialTarget stepId="unified-feed">
            <UnifiedFeed onRefresh={handleRefresh} />
          </TutorialTarget>
        </VStack>
      </ScrollView>

      {/* Crowd Report FAB - only visible when tents visited today */}
      {todayVisitedTents.length > 0 && (
        <CrowdReportFab onPress={handleCrowdFabPress} />
      )}

      {/* Crowd Report Prompt - after attendance save or from FAB */}
      {currentFestival?.id && crowdPromptTents.length > 0 && (
        <CrowdReportPrompt
          isOpen={showCrowdPrompt}
          onClose={handleCrowdPromptClose}
          tents={crowdPromptTents}
          festivalId={currentFestival.id}
        />
      )}
    </SafeAreaView>
  );
}
