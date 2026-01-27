import { cn } from "@prostcounter/ui";
import { useCallback } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

/**
 * Segmented control style tab bar for switching between form modes
 *
 * Features:
 * - iOS-style segmented control appearance
 * - Animated sliding indicator
 * - Disabled tab support
 * - Accessible with proper roles
 */
export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const tabWidth = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);

  // Calculate indicator position based on active tab index
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      width: tabWidth.value,
      transform: [
        {
          translateX: withSpring(indicatorPosition.value, {
            damping: 20,
            stiffness: 200,
          }),
        },
      ],
    };
  });

  // Handle tab layout to calculate widths
  const handleTabLayout = useCallback(
    (event: LayoutChangeEvent, index: number) => {
      const { width } = event.nativeEvent.layout;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
      tabWidth.value = width;

      // Update indicator position if this is the active tab
      if (index === activeIndex) {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
        indicatorPosition.value = index * width;
      }
    },
    [activeIndex, indicatorPosition, tabWidth],
  );

  // Update indicator position when active tab changes
  const handleTabPress = useCallback(
    (tab: Tab, index: number) => {
      if (tab.disabled) return;

      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
      indicatorPosition.value = index * tabWidth.value;
      onTabChange(tab.key);
    },
    [indicatorPosition, onTabChange, tabWidth],
  );

  return (
    <View className="relative w-full rounded-lg bg-background-100 p-1">
      {/* Animated sliding indicator */}
      <Animated.View
        style={animatedIndicatorStyle}
        className="absolute left-1 top-1 h-[calc(100%-8px)] rounded-md bg-background-0 shadow-sm"
      />

      {/* Tab buttons */}
      <HStack className="relative z-10">
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab, index)}
              onLayout={(e) => handleTabLayout(e, index)}
              disabled={isDisabled}
              className="flex-1 items-center justify-center py-2"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled: isDisabled }}
              accessibilityLabel={tab.label}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  isActive && "text-typography-900",
                  !isActive && isDisabled && "text-typography-300",
                  !isActive && !isDisabled && "text-typography-500",
                )}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </View>
  );
}

TabBar.displayName = "TabBar";
