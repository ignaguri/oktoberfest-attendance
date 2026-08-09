"use client";

import type { SeriesScope } from "@prostcounter/shared/schemas";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/client";

interface ScopeTabsProps {
  value: SeriesScope;
  onChange: (value: SeriesScope) => void;
}

/**
 * Festival / all-time selector. Both tabs render the same section tree from
 * the same response with a different filter, so there is no TabsContent —
 * this is a controlled selector and the page does the filtering.
 */
export function ScopeTabs({ value, onChange }: ScopeTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as SeriesScope)}>
      <TabsList className="w-full">
        <TabsTrigger value="festival">{t("achievements.scope.festival")}</TabsTrigger>
        <TabsTrigger value="lifetime">{t("achievements.scope.allTime")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
