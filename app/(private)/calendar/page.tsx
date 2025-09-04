import { AttendanceDialog } from "@/components/attendance/AttendanceDialog";
import { EventCalendar } from "@/components/calendar/EventCalendar";
import { ReservationDialog } from "@/components/reservations/ReservationDialog";
import {
  getCurrentFestivalForUser,
  fetchFestivalTentPricing,
} from "@/lib/festivalActions";

import { getPersonalCalendarEvents } from "./actions";

export default async function PersonalCalendarPage() {
  const currentFestival = await getCurrentFestivalForUser();
  const festivalId = currentFestival?.id;

  const events = festivalId ? await getPersonalCalendarEvents(festivalId) : [];

  const initialMonth = currentFestival
    ? new Date(currentFestival.start_date)
    : new Date();

  return (
    <div className="container flex flex-col items-center p-4">
      <h1 className="text-lg font-semibold mb-4">My Calendar</h1>
      <EventCalendar events={events} initialMonth={initialMonth} />
      <AttendanceDialog />
      {/* Preload tents and mount a URL-driven reservation dialog */}
      {currentFestival && (
        <ReservationDialog
          festivalId={currentFestival.id}
          tents={(await fetchFestivalTentPricing(currentFestival.id)).map(
            (t) => ({
              id: t.tent_id,
              name: (t as any).tent?.name ?? "Tent",
            }),
          )}
        />
      )}
    </div>
  );
}
