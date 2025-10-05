import { EventCalendar } from "@/components/calendar/EventCalendar";
import { ReservationDialog } from "@/components/reservations/ReservationDialog";
import { getCurrentFestivalForUser } from "@/lib/festivalActions";

import { getPersonalCalendarEvents } from "./actions";

export default async function PersonalCalendarPage() {
  const currentFestival = await getCurrentFestivalForUser();
  const festivalId = currentFestival?.id;

  const events = festivalId ? await getPersonalCalendarEvents(festivalId) : [];

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
      <h1 className="text-lg font-semibold mb-4">My Calendar</h1>
      <EventCalendar
        events={events}
        initialMonth={initialMonth}
        festivalStartDate={festivalStartDate}
        festivalEndDate={festivalEndDate}
      />
      {/* Mount a URL-driven reservation dialog */}
      {currentFestival && <ReservationDialog festivalId={currentFestival.id} />}
    </div>
  );
}
