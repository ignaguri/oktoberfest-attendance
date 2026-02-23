import { useTentCrowdStatus } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { TentCrowdStatus } from "@prostcounter/shared/schemas";
import { Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

import { CrowdLevelBadge } from "./crowd-level-badge";
import { CrowdReportSheet } from "./crowd-report-sheet";

interface CrowdStatusSummaryProps {
  festivalId: string;
}

/**
 * Summary card showing current crowd levels across tents.
 * Displayed on the home screen when there are recent reports.
 */
export function CrowdStatusSummary({ festivalId }: CrowdStatusSummaryProps) {
  const { t } = useTranslation();
  const { crowdStatuses, isLoading } = useTentCrowdStatus(festivalId);
  const [selectedTent, setSelectedTent] = useState<TentCrowdStatus | null>(
    null,
  );

  // Filter to tents with recent reports, sorted by crowd level (emptiest first)
  const tentsWithReports = useMemo(() => {
    const crowdOrder: Record<string, number> = {
      empty: 0,
      moderate: 1,
      crowded: 2,
      full: 3,
    };
    return (crowdStatuses as TentCrowdStatus[])
      .filter((s: TentCrowdStatus) => s.reportCount > 0 && s.crowdLevel)
      .sort(
        (a: TentCrowdStatus, b: TentCrowdStatus) =>
          (crowdOrder[a.crowdLevel!] ?? 99) - (crowdOrder[b.crowdLevel!] ?? 99),
      );
  }, [crowdStatuses]);

  const handleTentPress = useCallback((tent: TentCrowdStatus) => {
    setSelectedTent(tent);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedTent(null);
  }, []);

  // Don't show anything if loading or no reports
  if (isLoading) {
    return (
      <Card size="md" variant="elevated" className="p-3">
        <HStack space="sm" className="items-center justify-center py-2">
          <ActivityIndicator size="small" color={Colors.primary[500]} />
          <Text className="text-sm text-typography-500">
            {t("common.buttons.loading", { defaultValue: "Loading..." })}
          </Text>
        </HStack>
      </Card>
    );
  }

  if (tentsWithReports.length === 0) {
    return null;
  }

  return (
    <>
      <Card size="md" variant="elevated" className="p-3">
        <VStack space="sm">
          {/* Header */}
          <HStack space="sm" className="items-center">
            <Users size={18} color={IconColors.primary} />
            <Text className="text-base font-semibold text-typography-900">
              {t("crowdReport.currentLevels", {
                defaultValue: "Current Crowd Levels",
              })}
            </Text>
          </HStack>

          {/* Tent list */}
          <VStack space="xs">
            {tentsWithReports.slice(0, 5).map((tent: TentCrowdStatus) => (
              <Pressable
                key={tent.tentId}
                onPress={() => handleTentPress(tent)}
                className="rounded-lg px-2 py-2 active:bg-background-100"
                accessibilityLabel={`${tent.tentName} - ${tent.crowdLevel}`}
                accessibilityHint={t("crowdReport.reportCrowd", {
                  defaultValue: "Report Crowd",
                })}
              >
                <HStack className="items-center justify-between">
                  <Text className="flex-1 text-sm text-typography-700">
                    {tent.tentName}
                  </Text>
                  <HStack space="sm" className="items-center">
                    <CrowdLevelBadge
                      crowdLevel={tent.crowdLevel}
                      avgWaitMinutes={tent.avgWaitMinutes}
                    />
                  </HStack>
                </HStack>
              </Pressable>
            ))}
          </VStack>

          {tentsWithReports.length > 5 && (
            <Text className="text-center text-xs text-typography-400">
              +{tentsWithReports.length - 5} more
            </Text>
          )}
        </VStack>
      </Card>

      {/* Crowd Report Sheet */}
      {selectedTent && (
        <CrowdReportSheet
          isOpen={!!selectedTent}
          onClose={handleCloseSheet}
          tentId={selectedTent.tentId}
          tentName={selectedTent.tentName}
          festivalId={festivalId}
        />
      )}
    </>
  );
}

CrowdStatusSummary.displayName = "CrowdStatusSummary";
