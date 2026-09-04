import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Festival, FestivalStatus } from "@prostcounter/shared/schemas";
import { getFestivalStatus, groupFestivalsByStatus } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface FestivalSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_BADGE_CONFIG = {
  active: {
    labelKey: "festival.status.active",
    badgeClass: "bg-green-600",
    textClass: "text-green-100",
  },
  upcoming: {
    labelKey: "festival.status.upcoming",
    badgeClass: "bg-blue-500",
    textClass: "text-blue-100",
  },
  ended: {
    labelKey: "festival.status.ended",
    badgeClass: "bg-gray-400",
    textClass: "text-gray-100",
  },
} as const satisfies Record<
  FestivalStatus,
  { labelKey: string; badgeClass: string; textClass: string }
>;

export function FestivalSelectorSheet({ isOpen, onClose }: FestivalSelectorSheetProps) {
  const { t } = useTranslation();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();
  const [showPast, setShowPast] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);

  const { active, upcoming, past } = useMemo(
    () => groupFestivalsByStatus(festivals),
    [festivals],
  );

  const currentGroup = useMemo(() => [...active, ...upcoming], [active, upcoming]);

  // Expand the past section when collapsing it would hide the current
  // selection, or when there is nothing else to show.
  const shouldAutoExpand = useMemo(
    () =>
      past.some((festival) => festival.id === currentFestival?.id) || currentGroup.length === 0,
    [past, currentFestival, currentGroup],
  );

  // Apply the auto-expand decision only on the closed->open transition, so a
  // manual toggle made while the sheet is open is never silently overwritten.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setShowPast(shouldAutoExpand);
    }
  }

  const handleFestivalSelect = useCallback(
    (festival: Festival) => {
      setCurrentFestival(festival);
      onClose();
    },
    [setCurrentFestival, onClose],
  );

  const renderFestival = useCallback(
    (festival: Festival) => {
      const isSelected = festival.id === currentFestival?.id;
      const status = getFestivalStatus(festival);
      const { labelKey, badgeClass, textClass } = STATUS_BADGE_CONFIG[status];

      return (
        <ActionsheetItem
          key={festival.id}
          onPress={() => handleFestivalSelect(festival)}
          className={cn(isSelected && "bg-primary-50")}
        >
          <HStack className="w-full items-center justify-between">
            <VStack space="xs" className="flex-1">
              <HStack space="sm" className="items-center">
                <ActionsheetItemText
                  className={cn(isSelected && "font-semibold text-primary-600")}
                >
                  {festival.name}
                </ActionsheetItemText>
                <Badge size="sm" className={cn("rounded-md", badgeClass)}>
                  <BadgeText className={cn("capitalize", textClass)}>{t(labelKey)}</BadgeText>
                </Badge>
              </HStack>
              <Text className="text-xs text-typography-400">
                {format(parseISO(festival.startDate), "MMM d")} -{" "}
                {format(parseISO(festival.endDate), "MMM d, yyyy")}
              </Text>
              {festival.location && (
                <Text className="text-xs text-typography-400">{festival.location}</Text>
              )}
            </VStack>
            {isSelected && <Check size={20} color={Colors.primary[500]} />}
          </HStack>
        </ActionsheetItem>
      );
    },
    [currentFestival, handleFestivalSelect, t],
  );

  const pastLabel = t("festival.selector.pastFestivals", { count: past.length });

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack space="md" className="w-full px-4 pt-4">
          <Heading size="md" className="text-center">
            {t("festival.selector.title")}
          </Heading>
          <Text className="text-center text-sm text-typography-500">
            {t("festival.selector.description")}
          </Text>
        </VStack>
        <ActionsheetScrollView className="max-h-96 w-full">
          {currentGroup.map(renderFestival)}
          {past.length > 0 && (
            <>
              <Pressable
                className="w-full flex-row items-center justify-between px-3 py-3"
                onPress={() => setShowPast((previous) => !previous)}
                accessibilityRole="button"
                accessibilityLabel={pastLabel}
                accessibilityHint={t("festival.selector.pastFestivalsHint")}
                accessibilityState={{ expanded: showPast }}
              >
                <Text className="text-sm font-medium text-typography-500">{pastLabel}</Text>
                {showPast ? (
                  <ChevronUp size={20} color={IconColors.muted} />
                ) : (
                  <ChevronDown size={20} color={IconColors.muted} />
                )}
              </Pressable>
              {showPast && past.map(renderFestival)}
            </>
          )}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

FestivalSelectorSheet.displayName = "FestivalSelectorSheet";
