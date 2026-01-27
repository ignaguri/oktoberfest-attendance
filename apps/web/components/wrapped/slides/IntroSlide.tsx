"use client";

import Image from "next/image";
import { useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";

import { useConfetti } from "@/hooks/useConfetti";
import { ANIMATION_DELAYS, CELEBRATION_ANIMATION } from "@/lib/wrapped/config";
import type { WrappedData } from "@/lib/wrapped/types";
import LogoImage from "@/public/android-chrome-512x512.png";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./BaseSlide";

interface IntroSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function IntroSlide({ data, isActive = false }: IntroSlideProps) {
  const { isExploding, triggerConfetti } = useConfetti();
  const username = data.user_info.username || data.user_info.full_name || "You";

  // Trigger confetti after delay when slide becomes active
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(
        triggerConfetti,
        ANIMATION_DELAYS.confettiTrigger,
      );
      return () => clearTimeout(timer);
    }
  }, [isActive, triggerConfetti]);

  return (
    <BaseSlide
      isActive={isActive}
      animation={{
        ...CELEBRATION_ANIMATION,
        confetti: false, // We'll handle confetti separately
      }}
      className="bg-gradient-to-br from-yellow-50 to-orange-50"
    >
      {isExploding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConfettiExplosion
            force={0.8}
            duration={3000}
            particleCount={150}
            width={1600}
            zIndex={100}
          />
        </div>
      )}

      <div className="z-10 flex flex-col items-center gap-6">
        <Image
          src={LogoImage}
          alt="Prost Counter Logo"
          className="inline-block size-20 sm:size-24"
        />

        <SlideTitle className="bg-gradient-to-b from-yellow-400 to-yellow-600 bg-clip-text text-5xl text-transparent md:text-6xl">
          {data.festival_info.name}
        </SlideTitle>

        <SlideSubtitle className="text-2xl font-semibold">
          Festival Wrap
        </SlideSubtitle>

        <div className="mt-4 rounded-lg bg-white px-6 py-3 shadow-md">
          <p className="text-xl font-medium text-gray-700">
            {username}&apos;s festival highlights
          </p>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Swipe to see your wrap →</p>
        </div>
      </div>
    </BaseSlide>
  );
}
