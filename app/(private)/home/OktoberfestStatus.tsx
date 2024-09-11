import { differenceInDays, isWithinInterval } from "date-fns";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";

export default function OktoberfestStatus() {
  const today = new Date();
  let status = "";

  if (today < BEGINNING_OF_WIESN) {
    const daysRemaining = differenceInDays(BEGINNING_OF_WIESN, today);
    status = `Oktoberfest starts in ${daysRemaining} days!`;
  } else if (
    isWithinInterval(today, { start: BEGINNING_OF_WIESN, end: END_OF_WIESN })
  ) {
    const currentDay = differenceInDays(today, BEGINNING_OF_WIESN) + 1;
    const totalDays = differenceInDays(END_OF_WIESN, BEGINNING_OF_WIESN) + 1;
    status = `It&apos;s day ${currentDay} of ${totalDays} of Oktoberfest!`;
  } else {
    status = "Sadly, Oktoberfest is over. See you next year!";
  }

  return (
    <p className="text-center text-gray-900 font-semibold px-4">{status}</p>
  );
}
