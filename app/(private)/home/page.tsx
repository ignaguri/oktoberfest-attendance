import Link from "next/link";
import MissingFields from "./MissingFields";
import OktoberfestStatus from "./OktoberfestStatus";
import MyGroups from "@/components/MyGroups";
import { Button } from "@/components/ui/button";
import Highlights from "./Highlights";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import QuickAttendanceRegistration from "./QuickAttendanceRegistration";
import InstallPWA from "@/components/InstallPWA";
import { Separator } from "@/components/ui/separator";

export default async function Home() {
  return (
    <div className="max-w-lg flex flex-col">
      <h1 className="mb-6 text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span>
        <br />
        <span role="img" aria-label="beer">
          🍻
        </span>
      </h1>

      <div className="mb-4 flex flex-col gap-4">
        <OktoberfestStatus />
        <QuickAttendanceRegistration />
      </div>

      <div className="mb-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              What can I do with Prost Counter?
            </AccordionTrigger>
            <AccordionContent className="max-w-80 mx-auto">
              <p className="text-center text-gray-600">
                Compete with friends in different groups to see who visits
                Oktoberfest more often and drinks the most beers!
                <br />
                Track your progress and become the ultimate Wiesnmeister.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="flex flex-col gap-4">
        <MissingFields />
        <Highlights />
        <MyGroups />

        <Separator decorative />

        <div className="flex flex-col gap-2 items-center mt-4">
          <Button asChild variant="yellow">
            <Link href="/attendance">Register attendance</Link>
          </Button>
          <Button asChild variant="darkYellow">
            <Link href="/groups">Join or Create a group</Link>
          </Button>
        </div>
      </div>
      <InstallPWA />
    </div>
  );
}
