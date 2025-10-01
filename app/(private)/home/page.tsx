import { AchievementHighlight } from "@/components/achievements/AchievementHighlight";
import InstallPWA from "@/components/InstallPWA";
import MyGroups from "@/components/MyGroups/MyGroups";
import { NewsFeed } from "@/components/NewsFeed";
import ShareAppButton from "@/components/ShareAppButton";
import { TutorialOverlay } from "@/components/Tutorial/TutorialOverlay";
import { TutorialProvider } from "@/components/Tutorial/TutorialProvider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { getTutorialStatus } from "@/lib/sharedActions";
import LogoImage from "@/public/android-chrome-512x512.png";
import Image from "next/image";

import FestivalStatus from "./FestivalStatus";
import Highlights from "./Highlights";
import LeaderboardPreview from "./LeaderboardPreview";
import MapButton from "./MapButton";
import MissingFields from "./MissingFields";
import { QuickAttendanceWrapper } from "./QuickAttendanceWrapper";
import { WrappedCTA } from "./WrappedCTA";

export default async function Home() {
  const tutorialStatus = await getTutorialStatus();

  return (
    <TutorialProvider tutorialCompleted={tutorialStatus.tutorial_completed}>
      <div className="max-w-lg flex flex-col items-center gap-4">
        <header className="flex flex-row items-center gap-4">
          <Image
            src={LogoImage}
            alt="Prost Counter Logo"
            className="inline-block size-20 sm:size-24"
          />
          <h1 className="text-4xl font-extrabold sm:text-5xl" translate="no">
            <span className="text-yellow-600">Prost</span>
            <span className="text-yellow-500">Counter</span>
          </h1>
        </header>

        <div className="flex flex-col gap-4">
          <div data-tutorial="festival-status" className="self-center">
            <FestivalStatus />
          </div>
          <div data-tutorial="quick-attendance">
            <QuickAttendanceWrapper />
          </div>
        </div>

        <WrappedCTA />

        <NewsFeed />

        <div className="flex flex-col gap-4">
          <MissingFields />

          <div data-tutorial="highlights" className="flex flex-col gap-4">
            <Highlights />
            <LeaderboardPreview />
            <AchievementHighlight />
          </div>

          <Separator decorative />

          <div data-tutorial="groups">
            <MyGroups />
          </div>

          <Separator decorative />

          <div
            className="flex flex-col gap-2 items-center"
            data-tutorial="map-share"
          >
            <MapButton />
            <ShareAppButton />
          </div>
        </div>

        <Separator decorative />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="px-2">
              What can I do with Prost Counter?
            </AccordionTrigger>
            <AccordionContent className="max-w-80">
              <p className="text-center text-balance text-gray-600">
                Compete with friends in different groups to see who visits beer
                festivals more often and drinks the most beers!
                <br />
                Track your progress and become the ultimate beer festival
                champion.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <InstallPWA />
        <TutorialOverlay />
      </div>
    </TutorialProvider>
  );
}
