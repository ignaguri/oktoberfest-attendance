import { cn } from "@prostcounter/ui";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Spoken after the label, for what selecting this tab does. */
  accessibilityHint?: string;
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
  const indicatorPosition = useSharedValue(0);

  /*
   * Segment width lives in React state, not a shared value. This component can
   * remount between its layout callback and its effects (it does inside the
   * calendar action sheet), and a shared value written from that callback reads
   * back as 0 on the fresh instance — the effect below would then bail and never
   * position the indicator at all. As state, a measurement re-runs the effect.
   */
  const [tabWidth, setTabWidth] = useState(0);

  // Whether the indicator has been placed at least once on this instance. The
  // first placement snaps; later ones animate.
  const hasPositionedRef = useRef(false);

  // Clamped, because findIndex returns -1 for an activeTab that is not in `tabs`
  // and the indicator would park a whole segment off the left edge. Both current
  // callers pass a valid key, but a shared primitive should not rely on that.
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeTab),
  );

  /*
   * The style only reads the position. Wrapping the read in an animation
   * (withSpring/withTiming inside useAnimatedStyle) restarts that animation on
   * every recompute, which is what made the pill bounce and overshoot the
   * track: the effect below owns the animation, the style just follows it.
   */
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      width: tabWidth,
      transform: [{ translateX: indicatorPosition.value }],
    };
  });

  // Every segment is flex-1, so any one of them reports the width we need.
  const handleTabLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setTabWidth((current) => (current === width ? current : width));
  }, []);

  // Position the indicator: on the active tab changing (including changes driven
  // by the parent rather than a press here) and on the geometry first arriving.
  useEffect(() => {
    if (tabWidth === 0) {
      return;
    }

    const target = activeIndex * tabWidth;

    if (hasPositionedRef.current) {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
      indicatorPosition.value = withTiming(target, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // First placement is not a switch — snap, so nothing slides in on open.
      hasPositionedRef.current = true;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
      indicatorPosition.value = target;
    }
  }, [activeIndex, tabWidth, indicatorPosition]);

  const handleTabPress = useCallback(
    (tab: Tab) => {
      if (tab.disabled) {
        return;
      }

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

      {/*
        Tab buttons. The container declares the tablist so the role="tab" children
        sit inside the pattern they belong to, rather than being announced as
        orphan tabs.
      */}
      <HStack className="relative z-10" accessibilityRole="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab)}
              onLayout={handleTabLayout}
              disabled={isDisabled}
              // min-h-11 is 44pt, the smallest comfortable touch target. py-2
              // around 14px text landed near 36.
              className="min-h-11 flex-1 items-center justify-center py-2"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled: isDisabled }}
              accessibilityLabel={tab.label}
              accessibilityHint={tab.accessibilityHint}
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
