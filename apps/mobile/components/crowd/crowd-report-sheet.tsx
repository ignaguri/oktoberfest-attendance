import {
  useSubmitCrowdReport,
  useTentCrowdReports,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { CrowdLevel } from "@prostcounter/shared/schemas";
import { CircleAlert, Send, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

import { CROWD_COLORS } from "./crowd-level-badge";

const CROWD_LEVELS: CrowdLevel[] = ["empty", "moderate", "crowded", "full"];

const WAIT_TIME_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

/**
 * Calculate minutes since the most recent report.
 * Returns null if no reports or if the most recent report is older than 5 minutes.
 * Extracted as a pure function to satisfy React compiler purity rules.
 */
function getMinutesSinceLastReport(
  reports: ReadonlyArray<{ createdAt: string }>,
  now: number,
): number | null {
  if (reports.length === 0) return null;
  const reportTime = new Date(reports[0].createdAt).getTime();
  const diffMinutes = Math.floor((now - reportTime) / 60000);
  return diffMinutes <= 5 ? diffMinutes : null;
}

interface CrowdReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tentId: string;
  tentName: string;
  festivalId: string;
}

/**
 * Bottom sheet for submitting a crowd report for a tent.
 * Shows crowd level picker, wait time selector, and submit button.
 */
export function CrowdReportSheet({
  isOpen,
  onClose,
  tentId,
  tentName,
  festivalId,
}: CrowdReportSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedLevel, setSelectedLevel] = useState<CrowdLevel | null>(null);
  const [waitTimeMinutes, setWaitTimeMinutes] = useState<number | undefined>(
    undefined,
  );
  const [showSuccess, setShowSuccess] = useState(false);

  const { submitReport, isSubmitting, error, reset } = useSubmitCrowdReport();
  const { reports } = useTentCrowdReports(tentId, festivalId);

  // Derive minutes since last report (uses current time at render)
  // eslint-disable-next-line react-hooks/purity -- Date.now() is intentionally impure; we want the current time each render
  const minutesSinceLastReport = getMinutesSinceLastReport(reports, Date.now());

  const handleSubmit = useCallback(async () => {
    if (!selectedLevel) return;

    try {
      await submitReport({
        tentId,
        festivalId,
        crowdLevel: selectedLevel,
        waitTimeMinutes,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedLevel(null);
        setWaitTimeMinutes(undefined);
        onClose();
      }, 1500);
    } catch {
      // Error is handled by the hook
    }
  }, [
    selectedLevel,
    waitTimeMinutes,
    tentId,
    festivalId,
    submitReport,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    setSelectedLevel(null);
    setWaitTimeMinutes(undefined);
    setShowSuccess(false);
    reset();
    onClose();
  }, [onClose, reset]);

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack
          space="lg"
          className="px-2 pb-2 w-full"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {/* Header */}
          <HStack className="w-full items-center justify-between">
            <VStack>
              <Text className="text-lg font-semibold text-typography-900">
                {t("crowdReport.reportCrowd", {
                  defaultValue: "Report Crowd",
                })}
              </Text>
              <Text className="text-sm text-typography-500">{tentName}</Text>
            </VStack>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={24} color={IconColors.default} />
            </Pressable>
          </HStack>

          {/* User's recent report notice */}
          {minutesSinceLastReport != null && (
            <HStack
              space="sm"
              className="rounded-lg bg-yellow-50 px-3 py-2 items-center"
            >
              <CircleAlert size={16} color={Colors.primary[600]} />
              <Text className="text-sm text-yellow-700">
                {t("crowdReport.recentReport", {
                  minutes: minutesSinceLastReport,
                  defaultValue: `You reported ${minutesSinceLastReport} min ago`,
                })}
              </Text>
            </HStack>
          )}

          {/* Success message */}
          {showSuccess && (
            <View className="rounded-lg bg-green-50 px-4 py-3">
              <Text className="font-medium text-green-700 text-center">
                {t("crowdReport.success", {
                  defaultValue: "Report submitted!",
                })}
              </Text>
            </View>
          )}

          {!showSuccess && (
            <>
              {/* Crowd Level Selection */}
              <VStack space="sm">
                <Text className="text-sm font-medium text-typography-700">
                  {t("crowdReport.selectLevel", {
                    defaultValue: "How crowded is it?",
                  })}
                </Text>
                <HStack space="sm" className="w-full">
                  {CROWD_LEVELS.map((level) => {
                    const isSelected = selectedLevel === level;
                    const color = CROWD_COLORS[level];
                    return (
                      <Pressable
                        key={level}
                        onPress={() => setSelectedLevel(level)}
                        className={`rounded-xl px-2 py-3 flex-1 items-center border-2 ${
                          isSelected
                            ? "border-primary-500 bg-primary-50"
                            : "border-outline-200 bg-background-50"
                        }`}
                        accessibilityLabel={t(`crowdReport.levels.${level}`, {
                          defaultValue: level,
                        })}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <View
                          className="mb-1 h-4 w-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <Text
                          className={`text-xs font-medium text-center ${
                            isSelected
                              ? "text-primary-700"
                              : "text-typography-600"
                          }`}
                        >
                          {t(`crowdReport.levels.${level}`, {
                            defaultValue: level,
                          })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </HStack>
              </VStack>

              {/* Wait Time Selection */}
              <VStack space="sm">
                <HStack className="items-center justify-between">
                  <Text className="text-sm font-medium text-typography-700">
                    {t("crowdReport.waitTimeLabel", {
                      defaultValue: "Estimated wait time (minutes)",
                    })}
                  </Text>
                  <Text className="text-xs text-typography-400">
                    {t("crowdReport.waitTimeOptional", {
                      defaultValue: "Optional",
                    })}
                  </Text>
                </HStack>
                <View className="gap-2 flex-row flex-wrap">
                  {WAIT_TIME_OPTIONS.map((minutes) => {
                    const isSelected = waitTimeMinutes === minutes;
                    return (
                      <Pressable
                        key={minutes}
                        onPress={() =>
                          setWaitTimeMinutes(isSelected ? undefined : minutes)
                        }
                        className={`rounded-lg px-3 py-2 border ${
                          isSelected
                            ? "border-primary-500 bg-primary-50"
                            : "border-outline-200 bg-background-50"
                        }`}
                        accessibilityLabel={`${minutes} minutes`}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Text
                          className={`text-sm ${
                            isSelected
                              ? "font-medium text-primary-700"
                              : "text-typography-600"
                          }`}
                        >
                          {minutes === 0 ? "0" : minutes}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </VStack>

              {/* Error message */}
              {error && (
                <Text className="text-sm text-error-600">
                  {error.includes("5 minutes")
                    ? t("crowdReport.rateLimited", {
                        defaultValue: "You can report again in a few minutes",
                      })
                    : t("crowdReport.error", {
                        defaultValue: "Failed to submit report",
                      })}
                </Text>
              )}

              {/* Submit Button */}
              <Button
                variant="solid"
                action="primary"
                className="w-full"
                onPress={handleSubmit}
                isDisabled={!selectedLevel || isSubmitting}
              >
                {isSubmitting ? (
                  <ButtonSpinner color={Colors.white} />
                ) : (
                  <>
                    <Send size={18} color={IconColors.white} />
                    <ButtonText className="ml-2">
                      {t("crowdReport.submitReport", {
                        defaultValue: "Submit Report",
                      })}
                    </ButtonText>
                  </>
                )}
              </Button>
            </>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

CrowdReportSheet.displayName = "CrowdReportSheet";
