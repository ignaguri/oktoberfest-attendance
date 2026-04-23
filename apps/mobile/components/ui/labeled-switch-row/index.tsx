import { cn } from "@prostcounter/ui";
import type { LucideIcon } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors, SwitchColors } from "@/lib/constants/colors";

export interface LabeledSwitchRowProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  title: string;
  description?: string;
  /** Optional leading icon. Rendered at 16px with the default icon color. */
  icon?: LucideIcon;
  /**
   * Visual density:
   * - "compact" (default): inline inside lists/accordions — p-2, smaller text.
   * - "prominent": bottom sheets / standalone cards — p-4, bolder title.
   */
  variant?: "compact" | "prominent";
  accessibilityLabel?: string;
  /** Applied to the outer Pressable (useful for spacing like `mt-3`). */
  className?: string;
}

export function LabeledSwitchRow({
  value,
  onValueChange,
  title,
  description,
  icon: Icon,
  variant = "compact",
  accessibilityLabel,
  className,
}: LabeledSwitchRowProps) {
  const isProminent = variant === "prominent";
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      className={cn("active:opacity-80", className)}
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <HStack
        className={cn(
          "items-center justify-between rounded-lg",
          isProminent ? "bg-background-50 p-4" : "bg-background-0 p-2",
        )}
      >
        <HStack space="sm" className="flex-1 items-center pr-2">
          {Icon ? <Icon size={16} color={IconColors.default} /> : null}
          <VStack className="flex-1">
            <Text
              className={
                isProminent
                  ? "font-medium text-typography-900"
                  : "text-sm text-typography-700"
              }
            >
              {title}
            </Text>
            {description ? (
              <Text
                className={
                  isProminent
                    ? "text-sm text-typography-500"
                    : "text-xs text-typography-500"
                }
              >
                {description}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        <Switch
          size={isProminent ? "md" : "sm"}
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: SwitchColors.trackOff,
            true: SwitchColors.trackOn,
          }}
        />
      </HStack>
    </Pressable>
  );
}

LabeledSwitchRow.displayName = "LabeledSwitchRow";
