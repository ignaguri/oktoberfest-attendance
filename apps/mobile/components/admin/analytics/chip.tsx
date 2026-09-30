import { cn } from "@prostcounter/ui";
import Svg, { Circle } from "react-native-svg";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
  /** Series colour: renders a dot before the label and switches to a neutral selected look. */
  color?: string;
}

export function Chip({ label, selected, onPress, accessibilityHint, color }: ChipProps) {
  const hasColor = color !== undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      className={cn(
        "rounded-full border px-3 py-1.5",
        hasColor
          ? selected
            ? "border-outline-400 bg-background-0"
            : "border-outline-200 bg-background-0"
          : selected
            ? "border-primary-500 bg-primary-500"
            : "border-outline-200 bg-background-0",
      )}
    >
      <HStack space="xs" className="items-center">
        {hasColor && (
          <Svg width={8} height={8}>
            <Circle cx={4} cy={4} r={4} fill={color} />
          </Svg>
        )}
        <Text
          className={cn(
            "text-sm",
            hasColor
              ? selected
                ? "text-typography-900"
                : "text-typography-400"
              : selected
                ? "text-white"
                : "text-typography-700",
          )}
        >
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
}
