"use client";

import { EventCalendar } from "@/components/calendar/EventCalendar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ReservationDialog } from "@/components/reservations/ReservationDialog";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { use } from "react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GroupCalendarPage({ params }: PageProps) {
  const { id: groupId } = use(params);

  const { data: calendarData, loading } = useQuery(
    ["calendar", "group", groupId],
    () => apiClient.calendar.group(groupId),
    { enabled: !!groupId },
  );

  if (loading || !calendarData) {
    return (
      <div className="container flex flex-col items-center p-4">
        <h1 className="mb-4 text-lg font-semibold">Group Calendar</h1>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <LoadingSpinner />
          <span className="text-sm text-gray-500">Loading calendar...</span>
        </div>
      </div>
    );
  }

  // Transform API response events to the format expected by EventCalendar
  const events = calendarData.events.map((event) => ({
    id: event.id,
    title: event.title,
    from: new Date(event.from),
    to: event.to ? new Date(event.to) : undefined,
    type: event.type,
  }));

  const festivalStartDate = calendarData.festivalStartDate
    ? new Date(calendarData.festivalStartDate)
    : undefined;
  const festivalEndDate = calendarData.festivalEndDate
    ? new Date(calendarData.festivalEndDate)
    : undefined;
  const initialMonth = festivalStartDate || new Date();

  return (
    <div className="container flex flex-col items-center p-4">
      <h1 className="mb-4 text-lg font-semibold">Group Calendar</h1>
      <EventCalendar
        events={events}
        initialMonth={initialMonth}
        festivalStartDate={festivalStartDate}
        festivalEndDate={festivalEndDate}
      />
      {/* Mount a URL-driven reservation dialog */}
      {calendarData.festivalId && (
        <ReservationDialog festivalId={calendarData.festivalId} />
      )}
    </div>
  );
}
