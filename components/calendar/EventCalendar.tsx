"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TIMEZONE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TZDate } from "@date-fns/tz";
import { format as formatDate } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { CalendarEventType } from "@/lib/types";
import type { ReactNode } from "react";

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
  renderAddButton?: (date: Date | undefined) => ReactNode;
}

export function EventCalendar({
  events,
  initialMonth,
  selected,
  onSelect,
  renderAddButton,
}: EventCalendarProps) {
  const [date, setDate] = useState<Date | undefined>(selected ?? new Date());
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => setDate(selected), [selected]);

  // Build a lookup of dates that have events
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = formatDate(new TZDate(ev.from, TIMEZONE), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const datesWithEvents = useMemo(() => {
    return Array.from(eventsByDay.keys()).map((k) => {
      const [y, m, d] = k.split("-").map((n) => Number(n));
      // Month is 0-based
      return new Date(y, m - 1, d);
    });
  }, [eventsByDay]);

  const dayEvents = useMemo(() => {
    if (!date) return [] as CalendarEvent[];
    const key = formatDate(new TZDate(date, TIMEZONE), "yyyy-MM-dd");
    const events = eventsByDay.get(key) ?? [];

    // Sort events: beer_summary first, then by time
    return events.sort((a, b) => {
      // Beer summary events always come first
      if (a.type === "beer_summary" && b.type !== "beer_summary") return -1;
      if (b.type === "beer_summary" && a.type !== "beer_summary") return 1;

      // For other events, sort by time
      return (
        new TZDate(a.from, TIMEZONE).getTime() -
        new TZDate(b.from, TIMEZONE).getTime()
      );
    });
  }, [date, eventsByDay]);

  // Check if selected date has any reservations
  const hasReservations = useMemo(() => {
    return dayEvents.some((event) => event.type === "reservation");
  }, [dayEvents]);

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
          className="bg-transparent p-0 [--cell-size:--spacing(11)] md:[--cell-size:--spacing(12)]"
          required
          modifiers={{ hasEvents: datesWithEvents }}
          modifiersClassNames={{
            hasEvents: cn(
              "after:bg-primary/70 relative after:absolute after:inset-x-3 after:bottom-1 after:h-1 after:rounded-full",
            ),
          }}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 border-t px-4 !pt-4 w-full">
        <div className="flex w-full items-center justify-between px-1">
          <div className="text-xs font-medium">
            {date
              ? new TZDate(date, TIMEZONE).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "Select a date"}
          </div>
          <div
            className="h-4 w-px bg-muted-foreground/30"
            role="separator"
            aria-hidden="true"
          />
          {renderAddButton ? (
            renderAddButton(date)
          ) : (
            <div className="flex gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (date) {
                    params.set(
                      "date",
                      formatDate(new TZDate(date, TIMEZONE), "yyyy-MM-dd"),
                    );
                  }
                  params.set("newReservation", "1");
                  router.replace(`?${params.toString()}`);
                }}
                disabled={!date || hasReservations}
                title={
                  hasReservations
                    ? "Click on reservation to edit"
                    : "Add reservation"
                }
              >
                +Reservation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1"
                onClick={() => {
                  if (date) {
                    const dateStr = formatDate(
                      new TZDate(date, TIMEZONE),
                      "yyyy-MM-dd",
                    );
                    router.push(`/calendar/edit-attendance?date=${dateStr}`);
                  }
                }}
                disabled={!date}
                title="Add attendance"
              >
                +Attendance
              </Button>
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          {dayEvents.length === 0 && (
            <div className="text-muted-foreground text-sm">No events</div>
          )}
          {dayEvents.map((ev) => {
            // Different styling based on event type
            const getEventStyles = () => {
              switch (ev.type) {
                case "beer_summary":
                  return {
                    container: cn(
                      "bg-yellow-100 after:bg-yellow-500/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full cursor-pointer hover:bg-yellow-200 transition-colors",
                    ),
                    title: cn("font-bold text-yellow-800"),
                    time: cn("text-yellow-600 text-xs"),
                  };
                case "tent_visit":
                  return {
                    container: cn(
                      "bg-blue-50 after:bg-blue-500/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full cursor-pointer hover:bg-blue-100 transition-colors",
                    ),
                    title: cn("font-medium text-blue-900"),
                    time: cn("text-gray-600 text-xs"),
                  };
                case "reservation":
                  return {
                    container: cn(
                      "bg-green-50 after:bg-green-500/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full cursor-pointer hover:bg-green-100 transition-colors",
                    ),
                    title: cn("font-medium text-green-900"),
                    time: cn("text-green-600 text-xs"),
                  };
                default: // attendance
                  return {
                    container: cn(
                      "bg-muted after:bg-primary/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full cursor-pointer hover:bg-muted/80 transition-colors",
                    ),
                    title: cn("font-medium"),
                    time: cn("text-muted-foreground text-xs"),
                  };
              }
            };

            const styles = getEventStyles();

            const handleEventClick = () => {
              if (ev.type === "reservation") {
                // Navigate to edit reservation
                const params = new URLSearchParams(searchParams.toString());
                params.set("reservationId", ev.id);
                router.replace(`?${params.toString()}`);
              } else {
                // For attendance, tent_visit, and beer_summary events - go to attendance page
                if (date) {
                  const dateStr = formatDate(
                    new TZDate(date, TIMEZONE),
                    "yyyy-MM-dd",
                  );
                  router.push(`/attendance?date=${dateStr}`);
                }
              }
            };

            return (
              <div
                key={ev.id}
                className={styles.container}
                onClick={handleEventClick}
              >
                <div className={styles.title}>{ev.title}</div>
                <div className={styles.time}>
                  {ev.type === "beer_summary"
                    ? "Daily Total"
                    : formatDate(new TZDate(ev.from, TIMEZONE), "HH:mm")}
                  {ev.to
                    ? ` - ${formatDate(new TZDate(ev.to, TIMEZONE), "HH:mm")}`
                    : ""}
                </div>
              </div>
            );
          })}
        </div>
      </CardFooter>
    </Card>
  );
}
