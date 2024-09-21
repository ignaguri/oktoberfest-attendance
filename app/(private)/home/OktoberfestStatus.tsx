import { differenceInDays, isWithinInterval, isBefore } from "date-fns";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OctagonAlert } from "lucide-react";

export default function OktoberfestStatus() {
  const today = new Date();
  let status = "";

  if (isBefore(today, BEGINNING_OF_WIESN)) {
    const daysRemaining = differenceInDays(BEGINNING_OF_WIESN, today);
    status = `Oktoberfest starts in ${
      daysRemaining === 1 ? "a day" : `${daysRemaining} days`
    }!`;
  } else if (
    isWithinInterval(today, { start: BEGINNING_OF_WIESN, end: END_OF_WIESN })
  ) {
    const currentDay = differenceInDays(today, BEGINNING_OF_WIESN) + 1;
    const totalDays = differenceInDays(END_OF_WIESN, BEGINNING_OF_WIESN) + 1;
    status = `It's day ${currentDay} / ${totalDays} of Oktoberfest!`;
  } else {
    status = "Sadly, Oktoberfest is over. See you next year!";
  }

  return (
    <>
      <p className="text-center text-gray-900 font-semibold px-4">{status}</p>
      {isBefore(today, BEGINNING_OF_WIESN) && (
        <Alert variant="warning" className="mt-4">
          <OctagonAlert className="w-4 h-4" />
          <AlertDescription>
            All attendance data loaded now is just for testing and will be
            deleted before Oktoberfest starts.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
