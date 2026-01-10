import { useCallback, useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

import { AttendanceCard, type AttendanceData } from "./attendance-card";
export type { AttendanceData };

interface AttendanceListProps {
  attendances: AttendanceData[];
  onEdit: (attendance: AttendanceData) => void;
  onDelete: (attendance: AttendanceData) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Attendance list with swipe-to-delete
 *
 * Features:
 * - FlatList for efficient rendering
 * - Swipeable cards with delete action
 * - Pull-to-refresh
 * - Empty state
 */
export function AttendanceList({
  attendances,
  onEdit,
  onDelete,
  onRefresh,
  isRefreshing,
}: AttendanceListProps) {
  // Track open swipeable for closing when another opens
  const openSwipeableRef = useRef<Swipeable | null>(null);

  // Close any open swipeable
  const closeSwipeable = useCallback(() => {
    openSwipeableRef.current?.close();
    openSwipeableRef.current = null;
  }, []);

  // Render delete action on swipe
  const renderRightActions = useCallback(
    (attendance: AttendanceData) => {
      return (
        <RectButton
          style={{
            backgroundColor: "#ef4444",
            justifyContent: "center",
            alignItems: "center",
            width: 80,
            marginBottom: 12,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
          }}
          onPress={() => {
            closeSwipeable();
            onDelete(attendance);
          }}
        >
          <Trash2 size={24} color={IconColors.white} />
          <Text className="text-white text-xs mt-1">Delete</Text>
        </RectButton>
      );
    },
    [onDelete, closeSwipeable]
  );

  // Render each attendance item
  const renderItem = useCallback(
    ({ item }: { item: AttendanceData }) => {
      return (
        <Swipeable
          ref={(ref) => {
            // Close previous swipeable when a new one opens
            if (ref) {
              openSwipeableRef.current?.close();
            }
          }}
          onSwipeableOpen={() => {
            // Store ref of the currently open swipeable
          }}
          renderRightActions={() => renderRightActions(item)}
          rightThreshold={40}
          overshootRight={false}
        >
          <AttendanceCard attendance={item} onPress={onEdit} />
        </Swipeable>
      );
    },
    [onEdit, renderRightActions]
  );

  // Key extractor
  const keyExtractor = useCallback((item: AttendanceData) => item.id, []);

  // Empty state
  const renderEmptyState = useCallback(
    () => (
      <VStack className="items-center justify-center py-12">
        <Text className="text-typography-500 text-center">
          No attendance records yet
        </Text>
        <Text className="text-typography-400 text-sm text-center mt-2">
          Tap the + button to add your first entry
        </Text>
      </VStack>
    ),
    []
  );

  return (
    <FlatList
      data={attendances}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={renderEmptyState}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
    />
  );
}

AttendanceList.displayName = "AttendanceList";
