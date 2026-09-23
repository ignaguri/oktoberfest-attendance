"use client";

import { useFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform, Festival } from "@prostcounter/shared/schemas";
import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_RANGE_PRESET,
  festivalRangeKey,
  resolveAnalyticsRange,
} from "@prostcounter/shared/utils";
import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import ActivationFunnelSection from "./ActivationFunnelSection";
import FeatureUsageSection from "./FeatureUsageSection";
import FestivalRetentionSection from "./FestivalRetentionSection";
import OverviewSection from "./OverviewSection";

const ALL_PLATFORMS = "all";

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  // `useFestivals` is untyped at the call site (the shared `ApiClient` context
  // type is `any`), so annotate explicitly rather than let `.map` below fall
  // back to implicit `any` under `noImplicitAny`.
  const { data: festivals } = useFestivals() as { data: Festival[] | null };

  // A preset name ("30d") or a festival key ("festival:<id>").
  const [rangeKey, setRangeKey] = useState<string>(DEFAULT_ANALYTICS_RANGE_PRESET);
  const [platform, setPlatform] = useState<AnalyticsPlatform | undefined>(undefined);

  const range = useMemo(() => resolveAnalyticsRange(rangeKey, festivals), [rangeKey, festivals]);

  const handlePlatformChange = (value: string) => {
    if (value === "ios" || value === "android") {
      setPlatform(value);
    } else {
      setPlatform(undefined);
    }
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("admin.analytics.filters.range")}</span>
          <Select value={rangeKey} onValueChange={setRangeKey}>
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ANALYTICS_RANGE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {t(`admin.analytics.ranges.${preset}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
              {festivals && festivals.length > 0 && (
                <SelectGroup>
                  <SelectLabel>{t("admin.analytics.filters.festivals")}</SelectLabel>
                  {festivals.map((festival) => (
                    <SelectItem key={festival.id} value={festivalRangeKey(festival.id)}>
                      {festival.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("admin.analytics.filters.platform")}</span>
          <Select value={platform ?? ALL_PLATFORMS} onValueChange={handlePlatformChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PLATFORMS}>{t("admin.analytics.platforms.all")}</SelectItem>
              <SelectItem value="ios">{t("admin.analytics.platforms.ios")}</SelectItem>
              <SelectItem value="android">{t("admin.analytics.platforms.android")}</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <span className="text-sm text-muted-foreground">
          {range.from} – {range.to}
        </span>
      </div>

      <OverviewSection from={range.from} to={range.to} platform={platform} />
      <FeatureUsageSection from={range.from} to={range.to} />
      <ActivationFunnelSection from={range.from} to={range.to} />
      <FestivalRetentionSection />
    </div>
  );
}
