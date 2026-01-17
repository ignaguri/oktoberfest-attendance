"use client";

import type { LucideIcon } from "lucide-react";
import { Award, Beer, CalendarDays, Tent, Trophy } from "lucide-react";
import { forwardRef } from "react";

import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { WrappedData } from "@/lib/wrapped/types";
import { prepareShareImageData } from "@/lib/wrapped/utils";
import LogoImage from "@/public/android-chrome-512x512.png";

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
        "w-full rounded-3xl bg-white/80 p-8 shadow-lg backdrop-blur-sm",
        "flex items-center justify-center",
        className,
      )}
      style={{
        minHeight: "160px",
        // Safari-specific fixes for backdrop-blur
        WebkitBackdropFilter: "blur(8px)",
        backdropFilter: "blur(8px)",
        // Ensure proper rendering
        transform: "translateZ(0)",
      }}
    >
      <div className="grid w-full grid-cols-4 items-center gap-6">
        <Icon className="size-20 justify-self-center text-yellow-600" />
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
    const { t } = useTranslation();
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

      return t(
        `groups.winningCriteria.${shareData.bestGlobalPosition?.criteria}`,
      );
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
          // Safari-specific fixes
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          // Ensure proper rendering
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Header */}
        <header className="text-center">
          <p className="mb-4 bg-gradient-to-br from-yellow-500 to-yellow-600 bg-clip-text text-[140px] font-bold leading-tight text-transparent">
            My {shareData.festivalName}
          </p>
          <p className="text-[100px] font-bold leading-tight text-yellow-800">
            Wrapped
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid w-full grid-cols-2 gap-8">
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
          <div className="mb-3 text-3xl text-gray-600">Made with</div>
          <div className="flex flex-row items-center justify-center gap-4">
            <img
              src={LogoImage.src}
              alt="Prost Counter Logo"
              className="inline-block"
              style={{
                width: "80px",
                height: "80px",
                display: "block",
                flexShrink: 0,
                // Safari-specific fixes
                objectFit: "contain",
                maxWidth: "100%",
              }}
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
