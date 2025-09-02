import { EventCalendar } from "@/components/calendar/EventCalendar";
import { fetchFestivalById } from "@/lib/festivalActions";

import { getGroupCalendarEvents } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ festivalId?: string }>;
}

export default async function GroupCalendarPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { festivalId } = (searchParams ? await searchParams : {}) as {
    festivalId?: string;
  };

  // Try to load a specific festival if provided, otherwise fall back to active/recent
  const festival = festivalId ? await fetchFestivalById(festivalId) : null;

  const events = festival?.id
    ? await getGroupCalendarEvents(festival.id, id)
    : [];

  const initialMonth = festival ? new Date(festival.start_date) : new Date();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Group Calendar</h1>
      <EventCalendar events={events} initialMonth={initialMonth} />
    </div>
  );
}
