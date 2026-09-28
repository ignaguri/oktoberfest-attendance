import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { Check, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetSectionHeaderText,
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TentSearchInput } from "@/components/tent-selector/tent-search-input";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import {
  type AnalyticsRangeOption,
  type AnalyticsRangeSection,
  analyticsRangeSections,
} from "@/lib/admin/analytics-range-options";
import { IconColors } from "@/lib/constants/colors";

interface RangePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  presets: readonly AnalyticsRangeOption[];
  festivals: Parameters<typeof analyticsRangeSections>[1];
  rangeKey: string;
  onRangeKeyChange: (rangeKey: string) => void;
}

/** Searchable picker for the analytics time range: presets, then festivals. */
export function RangePickerSheet({
  isOpen,
  onClose,
  presets,
  festivals,
  rangeKey,
  onRangeKeyChange,
}: RangePickerSheetProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();
  // Both platforms draw the keyboard over the sheet (Android is edge-to-edge, so no window resize)
  const { keyboardHeight } = useKeyboardHeight();

  const sections = useMemo(
    () =>
      analyticsRangeSections(presets, festivals, searchQuery).map((section) => ({
        ...section,
        data: section.options,
      })),
    [presets, festivals, searchQuery],
  );

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleSelect = (key: string) => {
    onRangeKeyChange(key);
    handleClose();
  };

  const sectionTitle = (id: AnalyticsRangeSection["id"]) =>
    id === "presets"
      ? t("admin.analytics.filters.presets")
      : t("admin.analytics.filters.festivals");

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[80%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-3 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("admin.analytics.filters.range")}
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.buttons.close")}
          >
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <View className="mb-3 w-full px-2">
          <TentSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("admin.analytics.filters.search")}
          />
        </View>

        {sections.length === 0 ? (
          <VStack className="items-center justify-center py-8">
            <Text className="text-typography-500">{t("admin.analytics.filters.noMatch")}</Text>
          </VStack>
        ) : (
          <View className="max-h-[340px] w-full shrink">
            <SectionList
              sections={sections}
              keyExtractor={(option) => option.key}
              stickySectionHeadersEnabled
              keyboardShouldPersistTaps="handled"
              renderSectionHeader={({ section }) => (
                <ActionsheetSectionHeaderText className="bg-background-50">
                  {sectionTitle(section.id)}
                </ActionsheetSectionHeaderText>
              )}
              renderItem={({ item }) => {
                const isSelected = item.key === rangeKey;
                return (
                  <Pressable
                    onPress={() => handleSelect(item.key)}
                    className={cn("px-4 py-3", isSelected && "bg-primary-100")}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={item.label}
                  >
                    <HStack className="items-center justify-between">
                      <Text
                        className={cn(
                          isSelected ? "font-semibold text-primary-700" : "text-typography-700",
                        )}
                      >
                        {item.label}
                      </Text>
                      {isSelected && <Check size={20} color={IconColors.default} />}
                    </HStack>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* The sheet sits on its measured height, so growing it lifts the list over the keyboard.
            The content already pads for the bottom inset, which the keyboard covers. */}
        {keyboardHeight > 0 && (
          <View style={{ height: Math.max(keyboardHeight - insets.bottom, 0) }} />
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}
