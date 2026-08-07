import { SERIES_CATEGORY_ORDER } from "@prostcounter/shared/achievements";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesCategory } from "@prostcounter/shared/schemas";
import { ScrollView } from "react-native";

import { Badge, BadgeText } from "@/components/ui/badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";

export type CategoryFilter = "all" | SeriesCategory;

interface CategoryChipsProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

/**
 * Single-select category filter. achievements.categories.* holds the one-word
 * labels; achievements.filter.* holds full phrases written for the web
 * dropdown this mirrors.
 */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const { t } = useTranslation();

  const chips: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: t("achievements.filter.all") },
    ...SERIES_CATEGORY_ORDER.map((category) => ({
      key: category as CategoryFilter,
      label: t(`achievements.categories.${category}`),
    })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <HStack space="sm" className="items-center">
        {chips.map((chip) => {
          const isActive = chip.key === value;

          return (
            <Pressable
              key={chip.key}
              onPress={() => onChange(chip.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={chip.label}
              accessibilityHint={t("achievements.filter.selectCategory")}
            >
              <Badge
                action={isActive ? "info" : "muted"}
                variant={isActive ? "solid" : "outline"}
                size="md"
              >
                <BadgeText className="normal-case">{chip.label}</BadgeText>
              </Badge>
            </Pressable>
          );
        })}
      </HStack>
    </ScrollView>
  );
}

CategoryChips.displayName = "CategoryChips";
