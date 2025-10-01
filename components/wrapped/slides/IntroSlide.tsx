"use client";

import { useConfetti } from "@/hooks/useConfetti";
import { CELEBRATION_ANIMATION, ANIMATION_DELAYS } from "@/lib/wrapped/config";
import { useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";

import type { WrappedData } from "@/lib/wrapped/types";

import { BaseSlide, SlideTitle, SlideSubtitle } from "./BaseSlide";

interface IntroSlideProps {
  data: WrappedData;
}

export function IntroSlide({ data }: IntroSlideProps) {
  const { isExploding, triggerConfetti } = useConfetti();
  const username = data.user_info.username || data.user_info.full_name || "You";

  // Trigger confetti after delay
  useEffect(() => {
    const timer = setTimeout(triggerConfetti, ANIMATION_DELAYS.confettiTrigger);
    return () => clearTimeout(timer);
  }, [triggerConfetti]);

  return (
    <BaseSlide
      animation={CELEBRATION_ANIMATION}
      className="bg-gradient-to-br from-yellow-50 to-orange-50"
    >
      {isExploding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConfettiExplosion
            force={0.8}
            duration={3000}
            particleCount={150}
            width={1600}
          />
        </div>
      )}

      <div className="z-10 flex flex-col items-center gap-6">
        <div className="text-8xl">🍻</div>

        <SlideTitle className="text-5xl md:text-6xl">
          <span className="text-yellow-600">Your</span>{" "}
          <span className="text-yellow-500">Wrapped</span>
        </SlideTitle>

        <SlideSubtitle className="text-2xl font-semibold">
          {data.festival_info.name}
        </SlideSubtitle>

        <div className="mt-4 rounded-lg bg-white px-6 py-3 shadow-lg">
          <p className="text-xl font-medium text-gray-700">
            {username}&apos;s Festival Story
          </p>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Swipe to see your stats →</p>
        </div>
      </div>
    </BaseSlide>
  );
}
