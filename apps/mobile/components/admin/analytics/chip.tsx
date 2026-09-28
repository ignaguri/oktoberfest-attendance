import { cn } from "@prostcounter/ui";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
}

export function Chip({ label, selected, onPress, accessibilityHint }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      className={cn(
        "rounded-full border px-3 py-1.5",
        selected ? "border-primary-500 bg-primary-500" : "border-outline-200 bg-background-0",
      )}
    >
      <Text className={cn("text-sm", selected ? "text-white" : "text-typography-700")}>
        {label}
      </Text>
    </Pressable>
  );
}
