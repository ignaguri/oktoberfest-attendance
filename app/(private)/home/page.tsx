import { AchievementHighlight } from "@/components/achievements/AchievementHighlight";
import InstallPWA from "@/components/InstallPWA";
import MyGroups from "@/components/MyGroups/MyGroups";
import ShareAppButton from "@/components/ShareAppButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import LogoImage from "@/public/android-chrome-512x512.png";
import Image from "next/image";

import FestivalStatus from "./FestivalStatus";
import Highlights from "./Highlights";
import MapButton from "./MapButton";
import MissingFields from "./MissingFields";
import { QuickAttendanceWrapper } from "./QuickAttendanceWrapper";

export default async function Home() {
  return (
    <div className="max-w-lg flex flex-col">
      <header className="flex flex-col items-center gap-2">
        <Image
          src={LogoImage}
          alt="Prost Counter Logo"
          className="inline-block size-20 sm:size-24"
        />
        <h1 className="mb-6 text-4xl font-bold sm:text-5xl">
          <span className="font-extrabold text-yellow-600" translate="no">
            Prost
          </span>
          <span className="font-extrabold text-yellow-500" translate="no">
            Counter
          </span>
        </h1>
      </header>

      <div className="mb-4 flex flex-col gap-4">
        <FestivalStatus />
        <QuickAttendanceWrapper />
      </div>

      <div className="flex flex-col gap-4">
        <MissingFields />

        <Separator decorative />

        <Highlights />
        <AchievementHighlight />

        <Separator decorative />

        <MyGroups />

        <Separator decorative />

        <div className="flex flex-col gap-2 items-center">
          <MapButton />
          <ShareAppButton />
        </div>
      </div>

      <Separator className="my-4" decorative />

      <div className="mb-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              What can I do with Prost Counter?
            </AccordionTrigger>
            <AccordionContent className="max-w-80 mx-auto">
              <p className="text-center text-gray-600">
                Compete with friends in different groups to see who visits beer
                festivals more often and drinks the most beers!
                <br />
                Track your progress and become the ultimate beer festival
                champion.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <InstallPWA />
    </div>
  );
}
