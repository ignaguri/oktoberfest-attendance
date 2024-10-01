import BeerProgress from "@/components/BeerProgress";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";
import { differenceInDays, isWithinInterval, isBefore } from "date-fns";

export default function OktoberfestStatus() {
  const today = new Date();
  let status = "";
  let progress = 0;

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
    status = `Day ${currentDay}/${totalDays}`;
    progress = 100 - ((currentDay - 1) * 100) / totalDays;
  } else {
    status = "Sadly, Oktoberfest is over. See you next year!";
  }

  if (progress) {
    return <BeerProgress progress={progress} text={status} />;
  }

  return (
    <p className="text-center text-gray-900 font-semibold px-4">{status}</p>
  );
}
