"use client";

import { EventCalendar } from "@/components/calendar/EventCalendar";
import { ReservationDialog } from "@/components/reservations/ReservationDialog";
import { useFestival } from "@/contexts/FestivalContext";
import { usePersonalCalendar } from "@/hooks/useCalendar";
import { Loader2 } from "lucide-react";

export default function PersonalCalendarPage() {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const festivalId = currentFestival?.id;

  const {
    data: events,
    loading: eventsLoading,
    error,
  } = usePersonalCalendar(festivalId || "");

  const isLoading = festivalLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="container flex min-h-[50vh] flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <p className="text-muted-foreground mt-2">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container flex flex-col items-center p-4">
        <p className="text-red-500">Failed to load calendar events</p>
      </div>
    );
  }

  const initialMonth = currentFestival
    ? new Date(currentFestival.start_date)
    : new Date();

  const festivalStartDate = currentFestival
    ? new Date(currentFestival.start_date)
    : undefined;

  const festivalEndDate = currentFestival
    ? new Date(currentFestival.end_date)
    : undefined;

  return (
    <div className="container flex flex-col items-center p-4">
      <h1 className="mb-4 text-lg font-semibold">My Calendar</h1>
      <EventCalendar
        events={events || []}
        initialMonth={initialMonth}
        festivalStartDate={festivalStartDate}
        festivalEndDate={festivalEndDate}
      />
      {/* Mount a URL-driven reservation dialog */}
      {currentFestival && <ReservationDialog festivalId={currentFestival.id} />}
    </div>
  );
}
