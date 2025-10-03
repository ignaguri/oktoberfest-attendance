import { winningCriteriaText } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { prepareShareImageData } from "@/lib/wrapped/utils";
import LogoImage from "@/public/android-chrome-512x512.png";
import { Beer, CalendarDays, Trophy, Award, Tent } from "lucide-react";
import Image from "next/image";
import { forwardRef } from "react";

import type { WinningCriteria } from "@/lib/types";
import type { WrappedData } from "@/lib/wrapped/types";
import type { LucideIcon } from "lucide-react";

interface ShareImageProps {
  data: WrappedData;
  className?: string;
}

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  className?: string;
}

function StatCard({ icon: Icon, value, label, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg w-full",
        "flex items-center justify-center",
        className,
      )}
      style={{ minHeight: "160px" }}
    >
      <div className="grid grid-cols-4 items-center gap-6 w-full">
        <Icon className="size-20 text-yellow-600 justify-self-center" />
        <div className="col-span-3 text-center">
          <p className="text-5xl font-bold text-gray-800">{value}</p>
          <p className="text-2xl text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Share image component for social media (9:16 format)
 * Renders wrapped statistics in a vertical layout optimized for Instagram Stories
 */
export const ShareImage = forwardRef<HTMLDivElement, ShareImageProps>(
  ({ data, className }, ref) => {
    const shareData = prepareShareImageData(data);

    const getPositionText = (
      position: { position: number; criteria: string } | null,
    ) => {
      if (!position) return "Not ranked";

      const criteriaLabels = {
        days_attended: "Days",
        total_beers: "Beers",
        avg_beers: "Average",
      };

      return `#${position.position} in ${criteriaLabels[position.criteria as keyof typeof criteriaLabels]}`;
    };

    const getCriteriaLabel = () => {
      if (!shareData.bestGlobalPosition) return null;

      return winningCriteriaText[
        shareData.bestGlobalPosition?.criteria as WinningCriteria
      ];
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-gradient-to-br from-yellow-100 via-orange-100 to-amber-100",
          "flex flex-col items-center justify-between",
          className,
        )}
        style={{
          width: "1080px",
          height: "1920px",
          boxSizing: "border-box",
          padding: "80px 48px",
        }}
      >
        {/* Header */}
        <header className="text-center">
          <p className="text-[140px] leading-tight font-bold mb-4 bg-gradient-to-br from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
            My {shareData.festivalName}
          </p>
          <p className="text-[100px] leading-tight font-bold text-yellow-800">
            Wrapped
          </p>
        </header>

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-8">
          <StatCard
            icon={CalendarDays}
            value={shareData.daysAttended}
            label="Days attended"
          />

          <StatCard
            icon={Beer}
            value={shareData.beersDrunk}
            label="Beers drunk"
          />

          <StatCard
            icon={Tent}
            value={shareData.tentsVisited}
            label="Tents visited"
          />

          <StatCard
            icon={Trophy}
            value={shareData.podiumGroupsCount}
            label={`Podium${shareData.podiumGroupsCount > 1 ? "s" : ""} in groups`}
          />
        </div>
        <StatCard
          className="max-w-2xl"
          icon={Award}
          value={getPositionText(shareData.bestGlobalPosition)}
          label={`Best global rank - ${getCriteriaLabel()}`}
        />

        {/* Footer */}
        <footer className="text-center">
          <div className="text-3xl text-gray-600 mb-3">Made with</div>
          <div className="flex flex-row items-center gap-4">
            <Image
              src={LogoImage}
              alt="Prost Counter Logo"
              className="inline-block size-20 sm:size-24"
            />
            <h1 className="text-6xl font-extrabold" translate="no">
              <span className="text-yellow-600">Prost</span>
              <span className="text-yellow-500">Counter</span>
            </h1>
          </div>
          <div className="text-2xl text-gray-500">www.prostcounter.fun</div>
        </footer>
      </div>
    );
  },
);

ShareImage.displayName = "ShareImage";
