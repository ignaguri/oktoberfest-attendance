import { cn } from "@prostcounter/ui";
import { useCallback, useEffect } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

/**
 * Segmented control for switching between mutually exclusive views
 *
 * Features:
 * - iOS-style segmented control appearance
 * - Animated sliding indicator
 * - Disabled tab support
 * - Accessible with proper roles
 */
export function SegmentedControl({ tabs, activeTab, onTabChange }: SegmentedControlProps) {
  const tabWidth = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);

  // Calculate indicator position based on active tab index
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);

  /*
   * The style only reads the position. Wrapping the read in an animation
   * (withSpring/withTiming inside useAnimatedStyle) restarts that animation on
   * every recompute, which is what made the pill bounce and overshoot the
   * track: the switch below owns the animation, the style just follows it.
   */
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      width: tabWidth.value,
      transform: [{ translateX: indicatorPosition.value }],
    };
  });

  // Handle tab layout to calculate widths
  const handleTabLayout = useCallback(
    (event: LayoutChangeEvent, index: number) => {
      const { width } = event.nativeEvent.layout;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
      tabWidth.value = width;

      // Snap, don't animate: this is first paint, not a user switch.
      if (index === activeIndex) {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
        indicatorPosition.value = index * width;
      }
    },
    [activeIndex, indicatorPosition, tabWidth],
  );

  // Slide to the active tab whenever it changes, including changes driven by the
  // parent rather than by a press here. Skipped until the first layout lands.
  useEffect(() => {
    if (tabWidth.value === 0) {
      return;
    }
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
    indicatorPosition.value = withTiming(activeIndex * tabWidth.value, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, indicatorPosition, tabWidth]);

  const handleTabPress = useCallback(
    (tab: Tab) => {
      if (tab.disabled) return;

      onTabChange(tab.key);
    },
    [onTabChange],
  );

  return (
    <View className="relative w-full rounded-lg border border-outline-200 bg-background-200 p-1">
      {/*
       * Animated sliding indicator. Vertical size comes from top/bottom insets,
       * not a percentage height: `calc()` is a web-only CSS value and resolves to
       * nothing on native, which collapses the indicator to zero height.
       */}
      <Animated.View
        style={animatedIndicatorStyle}
        className="absolute bottom-1 left-1 top-1 rounded-md border border-outline-200 bg-background-0 shadow-md"
      />

      {/* Tab buttons */}
      <HStack className="relative z-10">
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab)}
              onLayout={(e) => handleTabLayout(e, index)}
              disabled={isDisabled}
              className="flex-1 items-center justify-center py-2"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled: isDisabled }}
              accessibilityLabel={tab.label}
            >
              <Text
                className={cn(
                  "text-sm",
                  isActive && "font-semibold text-typography-900",
                  !isActive && "font-medium",
                  !isActive && isDisabled && "text-typography-300",
                  !isActive && !isDisabled && "text-typography-600",
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

SegmentedControl.displayName = "SegmentedControl";
