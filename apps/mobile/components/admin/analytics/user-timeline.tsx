import { useAdminUserTimeline } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  ANALYTICS_TIMELINE_KINDS,
  type AnalyticsTimelineKind,
  type AnalyticsTimelineRow,
} from "@prostcounter/shared/schemas";
import {
  groupTimelineByDay,
  timelineLabelKey,
  timelinePropsText,
} from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { useMemo, useState } from "react";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { Chip } from "./chip";
import { SectionState } from "./section-state";

interface UserTimelineProps {
  userId: string;
}

function detailLine(row: AnalyticsTimelineRow): string {
  return [
    timelinePropsText(row.props),
    row.festivalName,
    row.kind === "event" ? `${row.platform ?? "?"} · ${row.appVersion ?? "?"}` : null,
  ]
    .filter((part): part is string => !!part)
    .join(" · ");
}

export function UserTimeline({ userId }: UserTimelineProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AnalyticsTimelineKind>("all");
  const { rows, loading, error, refetch, hasMore, loadMore, loadingMore } = useAdminUserTimeline(
    userId,
    kind,
  );

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = useMemo(() => groupTimelineByDay(rows, timeZone), [rows, timeZone]);
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }),
    [timeZone],
  );

  return (
    <VStack space="md">
      <HStack space="sm">
        {ANALYTICS_TIMELINE_KINDS.map((value) => (
          <Chip
            key={value}
            label={t(`admin.analytics.timeline.kinds.${value}`)}
            selected={value === kind}
            onPress={() => setKind(value)}
            accessibilityHint={t("admin.analytics.timeline.filterHint")}
          />
        ))}
      </HStack>
      <SectionState isLoading={loading} error={error} isEmpty={rows.length === 0} onRetry={refetch}>
        <VStack space="lg">
          {days.map((day) => (
            <VStack key={day.day} space="xs">
              <Text className="text-sm font-semibold text-typography-500">{day.day}</Text>
              {day.rows.map((row) => (
                <HStack
                  key={row.cursorKey}
                  space="md"
                  className={cn("rounded px-2 py-1.5", row.name === "error_shown" && "bg-error-50")}
                >
                  <Text className="w-12 text-xs text-typography-500">
                    {timeFormat.format(new Date(row.occurredAt))}
                  </Text>
                  <VStack className="flex-1">
                    <Text className="text-sm text-typography-900">
                      {t(timelineLabelKey(row.name), { name: row.name })}
                    </Text>
                    {detailLine(row) !== "" && (
                      <Text className="text-xs text-typography-500">{detailLine(row)}</Text>
                    )}
                  </VStack>
                </HStack>
              ))}
            </VStack>
          ))}
          {hasMore && (
            <Button
              variant="outline"
              isDisabled={loadingMore}
              onPress={loadMore}
              accessibilityLabel={t("admin.analytics.timeline.loadMore")}
              accessibilityHint={t("admin.analytics.timeline.openHint")}
            >
              {loadingMore && <ButtonSpinner />}
              <ButtonText>{t("admin.analytics.timeline.loadMore")}</ButtonText>
            </Button>
          )}
        </VStack>
      </SectionState>
    </VStack>
  );
}
