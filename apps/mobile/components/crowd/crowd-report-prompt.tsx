import { useTranslation } from "@prostcounter/shared/i18n";
import { Users, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

import { CrowdReportSheet } from "./crowd-report-sheet";

interface TentInfo {
  id: string;
  name: string;
}

interface CrowdReportPromptProps {
  isOpen: boolean;
  onClose: () => void;
  tents: TentInfo[];
  festivalId: string;
}

/**
 * Bottom sheet prompt shown after attendance is saved.
 * Asks the user to report crowd status for the tents they just visited.
 *
 * - If 1 tent: opens CrowdReportSheet directly (skips tent picker)
 * - If multiple tents: shows a list, tapping one opens CrowdReportSheet
 * - Dismissible: user can skip without reporting
 */
export function CrowdReportPrompt({
  isOpen,
  onClose,
  tents,
  festivalId,
}: CrowdReportPromptProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedTent, setSelectedTent] = useState<TentInfo | null>(null);

  // If only one tent, go directly to report sheet
  const singleTent = tents.length === 1 ? tents[0] : null;

  const handleTentPress = useCallback((tent: TentInfo) => {
    setSelectedTent(tent);
  }, []);

  const handleReportClose = useCallback(() => {
    setSelectedTent(null);
    // After reporting (or dismissing the report sheet), close the prompt too
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    setSelectedTent(null);
    onClose();
  }, [onClose]);

  // Single tent: show CrowdReportSheet directly instead of the picker
  if (singleTent) {
    return (
      <CrowdReportSheet
        isOpen={isOpen}
        onClose={handleClose}
        tentId={singleTent.id}
        tentName={singleTent.name}
        festivalId={festivalId}
      />
    );
  }

  return (
    <>
      <Actionsheet isOpen={isOpen && !selectedTent} onClose={handleClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack
            space="lg"
            className="w-full px-2 pb-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {/* Header */}
            <HStack className="w-full items-center justify-between">
              <HStack space="sm" className="items-center">
                <Users size={20} color={IconColors.primary} />
                <Text className="text-lg font-semibold text-typography-900">
                  {t("crowdReport.selectLevel")}
                </Text>
              </HStack>
              <Pressable onPress={handleClose} hitSlop={8}>
                <X size={24} color={IconColors.default} />
              </Pressable>
            </HStack>

            <Text className="text-sm text-typography-500">
              {t("crowdReport.promptDescription")}
            </Text>

            {/* Tent list */}
            <VStack space="xs">
              {tents.map((tent) => (
                <Pressable
                  key={tent.id}
                  onPress={() => handleTentPress(tent)}
                  className="rounded-lg border border-outline-200 px-4 py-3 active:bg-background-100"
                  accessibilityLabel={tent.name}
                  accessibilityHint={t("crowdReport.reportCrowd")}
                >
                  <HStack className="items-center justify-between">
                    <Text className="text-base text-typography-700">
                      {tent.name}
                    </Text>
                    <Users size={16} color={IconColors.muted} />
                  </HStack>
                </Pressable>
              ))}
            </VStack>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {/* Crowd Report Sheet for selected tent */}
      {selectedTent && (
        <CrowdReportSheet
          isOpen={!!selectedTent}
          onClose={handleReportClose}
          tentId={selectedTent.id}
          tentName={selectedTent.name}
          festivalId={festivalId}
        />
      )}
    </>
  );
}

CrowdReportPrompt.displayName = "CrowdReportPrompt";
