"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { format as formatDate } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export type CalendarEventType = "attendance" | "reservation";

export interface CalendarEvent {
  id: string;
  title: string;
  from: Date;
  to?: Date | null;
  type: CalendarEventType;
  meta?: Record<string, unknown>;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  initialMonth?: Date;
  selected?: Date | undefined;
  onSelect?: (date: Date | undefined) => void;
  renderAddButton?: (date: Date | undefined) => React.ReactNode;
}

export function EventCalendar({
  events,
  initialMonth,
  selected,
  onSelect,
  renderAddButton,
}: EventCalendarProps) {
  const [date, setDate] = React.useState<Date | undefined>(selected);
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => setDate(selected), [selected]);

  // Build a lookup of dates that have events
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = formatDate(new TZDate(ev.from, TIMEZONE), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const datesWithEvents = React.useMemo(() => {
    return Array.from(eventsByDay.keys()).map((k) => {
      const [y, m, d] = k.split("-").map((n) => Number(n));
      // Month is 0-based
      return new Date(y, m - 1, d);
    });
  }, [eventsByDay]);

  const dayEvents = React.useMemo(() => {
    if (!date) return [] as CalendarEvent[];
    const key = formatDate(new TZDate(date, TIMEZONE), "yyyy-MM-dd");
    return eventsByDay.get(key) ?? [];
  }, [date, eventsByDay]);

  return (
    <Card className="w-fit py-4">
      <CardContent className="px-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d);
            onSelect?.(d);
          }}
          defaultMonth={date ?? initialMonth}
          className="bg-transparent p-0"
          required
          modifiers={{ hasEvents: datesWithEvents }}
          modifiersClassNames={{
            hasEvents:
              "after:bg-primary/70 relative after:absolute after:inset-x-3 after:bottom-1 after:h-1 after:rounded-full",
          }}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 border-t px-4 !pt-4 w-full">
        <div className="flex w-full items-center justify-between px-1">
          <div className="text-sm font-medium">
            {date
              ? new TZDate(date, TIMEZONE).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "Select a date"}
          </div>
          {renderAddButton ? (
            renderAddButton(date)
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                if (date) {
                  params.set(
                    "date",
                    formatDate(new TZDate(date, TIMEZONE), "yyyy-MM-dd"),
                  );
                }
                // Default to reservation flow if no modifier key, else attendance edit
                if (window.event && (window.event as MouseEvent).altKey) {
                  params.delete("newReservation");
                  params.set("editAttendance", "1");
                } else {
                  params.set("newReservation", "1");
                }
                router.replace(`?${params.toString()}`);
              }}
              disabled={!date}
              title="Add reservation"
            >
              Add
            </Button>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          {dayEvents.length === 0 && (
            <div className="text-muted-foreground text-sm">No events</div>
          )}
          {dayEvents.map((ev) => (
            <div
              key={ev.id}
              className="bg-muted after:bg-primary/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full"
            >
              <div className="font-medium">{ev.title}</div>
              <div className="text-muted-foreground text-xs">
                {formatDate(new TZDate(ev.from, TIMEZONE), "HH:mm")}
                {ev.to
                  ? ` - ${formatDate(new TZDate(ev.to, TIMEZONE), "HH:mm")}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
