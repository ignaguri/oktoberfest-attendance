import { EventCalendar } from "@/components/calendar/EventCalendar";
import { ReservationDialog } from "@/components/reservations/ReservationDialog";

import { getGroupCalendarData } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupCalendarPage({ params }: PageProps) {
  const { id: groupId } = await params;

  const {
    events,
    initialMonth,
    festivalId,
    festivalStartDate,
    festivalEndDate,
  } = await getGroupCalendarData(groupId);

  return (
    <div className="container flex flex-col items-center p-4">
      <h1 className="text-lg font-semibold mb-4">Group Calendar</h1>
      <EventCalendar
        events={events}
        initialMonth={initialMonth}
        festivalStartDate={festivalStartDate}
        festivalEndDate={festivalEndDate}
      />
      {/* Mount a URL-driven reservation dialog */}
      {festivalId && <ReservationDialog festivalId={festivalId} />}
    </div>
  );
}
