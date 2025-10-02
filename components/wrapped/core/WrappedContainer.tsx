"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { hasWrappedData } from "@/lib/wrapped/utils";
import { useEffect, useRef } from "react";
import { Keyboard, Mousewheel, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import type { WrappedData } from "@/lib/wrapped/types";

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

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

interface WrappedContainerProps {
  data: WrappedData;
}

export function WrappedContainer({ data }: WrappedContainerProps) {
  const swiperRef = useRef<any>(null);

  // Scroll to Swiper container when component mounts
  useEffect(() => {
    if (swiperRef.current?.swiper?.el) {
      // Scroll the Swiper container to the top of the viewport
      swiperRef.current.swiper.el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

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

  // Handle slide change to scroll to Swiper container
  const handleSlideChange = () => {
    if (swiperRef.current?.swiper?.el) {
      // Scroll the Swiper container to the top of the viewport
      swiperRef.current.swiper.el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <Swiper
        ref={swiperRef}
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
        onSlideChange={handleSlideChange}
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
