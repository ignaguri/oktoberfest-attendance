import { cn } from "@prostcounter/ui";
import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { barFraction } from "@/lib/charts/sparkline-path";
import { Colors } from "@/lib/constants/colors";

const BAR_HEIGHT = 8;
const BAR_RADIUS = 4;

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Right-hand text; defaults to the value. */
  detail?: string;
  /** Greys the row out (e.g. a dead feature). */
  muted?: boolean;
}

interface BarListProps {
  items: readonly BarListItem[];
  /** Value that fills a whole track; defaults to the largest item. */
  max?: number;
}

export function BarList({ items, max }: BarListProps) {
  // SVG needs a pixel width for the filled rect, so measure the first track
  // once; every track shares the same width.
  const [trackWidth, setTrackWidth] = useState(0);
  const scaleMax = max ?? Math.max(0, ...items.map((item) => item.value));

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <VStack space="md">
      {items.map((item, index) => (
        <VStack key={item.key} space="xs">
          <HStack space="sm" className="justify-between">
            <Text
              className={cn(
                "flex-1 text-sm",
                item.muted ? "text-typography-400" : "text-typography-900",
              )}
            >
              {item.label}
            </Text>
            <Text className="text-sm text-typography-500">{item.detail ?? String(item.value)}</Text>
          </HStack>
          <View className="w-full" onLayout={index === 0 ? handleTrackLayout : undefined}>
            <Svg width="100%" height={BAR_HEIGHT}>
              <Rect
                x={0}
                y={0}
                width={trackWidth}
                height={BAR_HEIGHT}
                rx={BAR_RADIUS}
                fill={Colors.gray[200]}
              />
              <Rect
                x={0}
                y={0}
                width={trackWidth * barFraction(item.value, scaleMax)}
                height={BAR_HEIGHT}
                rx={BAR_RADIUS}
                fill={item.muted ? Colors.gray[300] : Colors.primary[500]}
              />
            </Svg>
          </View>
        </VStack>
      ))}
    </VStack>
  );
}
