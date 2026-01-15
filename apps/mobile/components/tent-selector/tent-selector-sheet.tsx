import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetSectionHeaderText,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import {
  useTents,
  type TentGroup,
  type TentOption,
} from "@prostcounter/shared/hooks";
import { X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  type SectionListData,
  type SectionListRenderItemInfo,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TentListItem } from "./tent-list-item";
import { TentSearchInput } from "./tent-search-input";

interface TentSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  mode: "single" | "multi";
  // For single-select
  selectedTent?: string;
  onSelectTent?: (tentId: string) => void;
  // For multi-select
  selectedTents?: string[];
  onSelectTents?: (tentIds: string[]) => void;
}

interface SectionData {
  title: string;
  data: TentOption[];
}

/**
 * Reusable tent selector actionsheet
 *
 * Supports both single-select (for Home) and multi-select (for Attendance).
 * Features:
 * - Search by tent name
 * - Grouped by category using SectionList
 * - Single-select: tap closes sheet immediately
 * - Multi-select: tap toggles checkbox, Close to finish
 */
export function TentSelectorSheet({
  isOpen,
  onClose,
  festivalId,
  mode,
  selectedTent,
  onSelectTent,
  selectedTents = [],
  onSelectTents,
}: TentSelectorSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { tents, isLoading, error } = useTents(festivalId);
  const insets = useSafeAreaInsets();

  // Filter tents based on search query
  const filteredSections: SectionData[] = useMemo(() => {
    if (!tents.length) return [];

    const query = searchQuery.toLowerCase().trim();

    return tents
      .map((group: TentGroup) => ({
        title: group.category,
        data: query
          ? group.options.filter((opt) =>
              opt.label.toLowerCase().includes(query),
            )
          : group.options,
      }))
      .filter((section) => section.data.length > 0);
  }, [tents, searchQuery]);

  // Check if a tent is selected
  const isTentSelected = useCallback(
    (tentId: string) => {
      if (mode === "single") {
        return selectedTent === tentId;
      }
      return selectedTents.includes(tentId);
    },
    [mode, selectedTent, selectedTents],
  );

  // Handle tent toggle
  const handleTentToggle = useCallback(
    (tentId: string) => {
      if (mode === "single") {
        onSelectTent?.(tentId);
        onClose();
      } else {
        const newSelection = selectedTents.includes(tentId)
          ? selectedTents.filter((id) => id !== tentId)
          : [...selectedTents, tentId];
        onSelectTents?.(newSelection);
      }
    },
    [mode, selectedTents, onSelectTent, onSelectTents, onClose],
  );

  // Handle clear selection (multi-select only)
  const handleClear = useCallback(() => {
    onSelectTents?.([]);
  }, [onSelectTents]);

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<TentOption, SectionData> }) => (
      <ActionsheetSectionHeaderText className="bg-background-50">
        {section.title}
      </ActionsheetSectionHeaderText>
    ),
    [],
  );

  // Render tent item
  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<TentOption, SectionData>) => (
      <TentListItem
        tentId={item.value}
        tentName={item.label}
        isSelected={isTentSelected(item.value)}
        onToggle={handleTentToggle}
        mode={mode}
      />
    ),
    [isTentSelected, handleTentToggle, mode],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: TentOption, index: number) => item.value,
    [],
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[80%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="mb-3 w-full items-center justify-between px-2">
          <Text className="text-typography-900 text-lg font-semibold">
            {mode === "single" ? "Select Tent" : "Select Tents"}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        {/* Search Input */}
        <View className="mb-3 w-full px-2">
          <TentSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tents..."
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <VStack className="items-center justify-center py-8">
            <ActivityIndicator size="large" color={IconColors.default} />
            <Text className="text-typography-500 mt-2">Loading tents...</Text>
          </VStack>
        ) : error ? (
          <VStack className="items-center justify-center py-8">
            <Text className="text-error-600">Failed to load tents</Text>
          </VStack>
        ) : filteredSections.length === 0 ? (
          <VStack className="items-center justify-center py-8">
            <Text className="text-typography-500">
              {searchQuery
                ? "No tents match your search"
                : "No tents available"}
            </Text>
          </VStack>
        ) : (
          <View style={{ width: "100%", maxHeight: 340 }}>
            <SectionList<TentOption, SectionData>
              sections={filteredSections}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={keyExtractor}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator
            />
          </View>
        )}

        {/* Footer (multi-select only) */}
        {mode === "multi" && (
          <HStack
            className="w-full gap-3 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          >
            <Button
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={handleClear}
              isDisabled={selectedTents.length === 0}
            >
              <ButtonText>Clear</ButtonText>
            </Button>
            <Button
              variant="solid"
              action="primary"
              className="flex-1"
              onPress={onClose}
            >
              <ButtonText>
                Done
                {selectedTents.length > 0 ? ` (${selectedTents.length})` : ""}
              </ButtonText>
            </Button>
          </HStack>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}

TentSelectorSheet.displayName = "TentSelectorSheet";
