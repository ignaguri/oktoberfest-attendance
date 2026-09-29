"use client";

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

import { Button } from "@/components/ui/button";

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

export default function UserTimeline({ userId }: UserTimelineProps) {
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

  let body;
  if (error) {
    body = (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{t("admin.analytics.loadError")}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void refetch();
          }}
        >
          {t("admin.analytics.retry")}
        </Button>
      </div>
    );
  } else if (loading) {
    body = <p className="text-sm text-muted-foreground">{t("admin.analytics.members.loading")}</p>;
  } else if (rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t("admin.analytics.timeline.empty")}</p>;
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {days.map((day) => (
          <section key={day.day} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-muted-foreground">{day.day}</h3>
            <ul className="flex flex-col">
              {day.rows.map((row) => (
                <li
                  key={row.cursorKey}
                  className={cn(
                    "flex gap-3 rounded px-2 py-1.5",
                    row.name === "error_shown" && "bg-destructive/10",
                  )}
                >
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {timeFormat.format(new Date(row.occurredAt))}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm">
                      {t(timelineLabelKey(row.name), { name: row.name })}
                    </span>
                    {detailLine(row) && (
                      <span className="text-xs text-muted-foreground">{detailLine(row)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {hasMore && (
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {t("admin.analytics.timeline.loadMore")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {ANALYTICS_TIMELINE_KINDS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === kind ? "default" : "outline"}
            onClick={() => setKind(value)}
          >
            {t(`admin.analytics.timeline.kinds.${value}`)}
          </Button>
        ))}
      </div>
      {body}
    </div>
  );
}
