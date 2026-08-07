"use client";

import { SERIES_CATEGORY_ORDER } from "@prostcounter/shared/achievements";
import type { SeriesCategory } from "@prostcounter/shared/schemas";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type CategoryFilter = "all" | SeriesCategory;

interface CategoryChipsProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const { t } = useTranslation();

  // achievements.categories.* holds the one-word labels; achievements.filter.*
  // holds full phrases written for the dropdown this replaces.
  const chips: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: t("achievements.filter.all") },
    ...SERIES_CATEGORY_ORDER.map((category) => ({
      key: category as CategoryFilter,
      label: t(`achievements.categories.${category}`),
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const isActive = chip.key === value;

        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(chip.key)}
          >
            <Badge
              variant={isActive ? "default" : "outline"}
              className={cn("cursor-pointer px-3 py-1 text-sm", !isActive && "hover:bg-accent")}
            >
              {chip.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
