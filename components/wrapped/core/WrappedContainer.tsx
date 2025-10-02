"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { hasWrappedData } from "@/lib/wrapped/utils";
import { Keyboard, Mousewheel, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import type { WrappedData } from "@/lib/wrapped/types";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

// Import slides
import {
  IntroSlide,
  NumbersSlide,
  JourneySlide,
  TentExplorerSlide,
  PeakMomentSlide,
  SocialSlide,
  AchievementsSlide,
  PersonalitySlide,
  RankingsSlide,
  ComparisonsSlide,
  OutroSlide,
} from "../slides";

interface WrappedContainerProps {
  data: WrappedData;
}

export function WrappedContainer({ data }: WrappedContainerProps) {
  // Check if user has data
  if (!hasWrappedData(data)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl text-gray-600">
            No wrapped data available for this festival
          </p>
        </div>
      </div>
    );
  }

  // Define slide configurations with keys
  const slides = [
    { key: "intro", component: IntroSlide },
    { key: "numbers", component: NumbersSlide },
    { key: "journey", component: JourneySlide },
    { key: "tent_explorer", component: TentExplorerSlide },
    { key: "peak_moment", component: PeakMomentSlide },
    { key: "social", component: SocialSlide },
    ...(data.achievements.length > 0
      ? [{ key: "achievements", component: AchievementsSlide }]
      : []),
    { key: "personality", component: PersonalitySlide },
    ...(data.social_stats.top_3_rankings.length > 0
      ? [{ key: "rankings", component: RankingsSlide }]
      : []),
    ...(data.comparisons
      ? [{ key: "comparisons", component: ComparisonsSlide }]
      : []),
    { key: "outro", component: OutroSlide },
  ];

  console.log("data", data);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <Swiper
        modules={[Keyboard, Mousewheel, Pagination]}
        direction="horizontal"
        slidesPerView={1}
        spaceBetween={0}
        keyboard={{
          enabled: true,
          onlyInViewport: true,
        }}
        mousewheel={{
          forceToAxis: true,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        speed={500}
        noSwipingClass="recharts-responsive-container" // Prevents Swiper from swiping on Recharts charts
      >
        {slides.map((slide) => {
          const SlideComponent = slide.component;
          return (
            <SwiperSlide key={slide.key} className="h-full">
              <SlideComponent data={data} />
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

/**
 * Loading state component
 */
export function WrappedLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size={48} />
        <p className="text-xl font-semibold text-gray-700">
          Preparing your wrapped...
        </p>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
export function WrappedError({ message }: { message?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
        <p className="text-gray-600">
          {message || "Something went wrong loading your wrapped"}
        </p>
      </div>
    </div>
  );
}
