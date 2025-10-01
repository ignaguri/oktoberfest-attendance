"use client";

import { hasWrappedData } from "@/lib/wrapped/utils";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { Keyboard, Mousewheel, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import type { WrappedData } from "@/lib/wrapped/types";
import type { Swiper as SwiperType } from "swiper";

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
  onShare?: () => void;
}

export function WrappedContainer({ data, onShare }: WrappedContainerProps) {
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSlideChange = useCallback((swiper: SwiperType) => {
    setActiveIndex(swiper.activeIndex);
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

  return (
    <div className="relative h-screen w-full overflow-hidden">
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
        onSwiper={setSwiper}
        onSlideChange={handleSlideChange}
        className="h-full w-full"
      >
        <SwiperSlide>
          <AnimatePresence mode="wait">
            <IntroSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <NumbersSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <JourneySlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <TentExplorerSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <PeakMomentSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <SocialSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        {data.achievements.length > 0 && (
          <SwiperSlide>
            <AnimatePresence mode="wait">
              <AchievementsSlide data={data} />
            </AnimatePresence>
          </SwiperSlide>
        )}

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <PersonalitySlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        {data.social_stats.top_3_rankings.length > 0 && (
          <SwiperSlide>
            <AnimatePresence mode="wait">
              <RankingsSlide data={data} />
            </AnimatePresence>
          </SwiperSlide>
        )}

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <ComparisonsSlide data={data} />
          </AnimatePresence>
        </SwiperSlide>

        <SwiperSlide>
          <AnimatePresence mode="wait">
            <OutroSlide data={data} onShare={onShare} />
          </AnimatePresence>
        </SwiperSlide>
      </Swiper>

      {/* Slide counter */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
        {activeIndex + 1} / {swiper?.slides.length || 0}
      </div>
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
        <Loader2 className="h-12 w-12 animate-spin text-yellow-600" />
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
