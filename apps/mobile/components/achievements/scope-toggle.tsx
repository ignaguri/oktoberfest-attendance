import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesScope } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

interface ScopeToggleProps {
  value: SeriesScope;
  onChange: (value: SeriesScope) => void;
}

/**
 * Two-segment festival / all-time selector. Built from Pressable rather than a
 * tabs primitive because the mobile UI kit has none, and a two-value control
 * does not justify a new dependency. Exactly one segment is always active —
 * unlike CategoryChips, there is no "all" option.
 */
export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  const { t } = useTranslation();

  const segments: { key: SeriesScope; label: string }[] = [
    { key: "festival", label: t("achievements.scope.festival") },
    { key: "lifetime", label: t("achievements.scope.allTime") },
  ];

  return (
    <HStack className="rounded-lg bg-background-100 p-1">
      {segments.map((segment) => {
        const isActive = segment.key === value;

        return (
          <Pressable
            key={segment.key}
            onPress={() => onChange(segment.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={segment.label}
            className={cn("flex-1 rounded-md py-2", isActive && "bg-white shadow-sm")}
          >
            <Text
              className={cn(
                "text-center text-sm",
                isActive ? "font-semibold text-typography-900" : "text-typography-500",
              )}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}

ScopeToggle.displayName = "ScopeToggle";
