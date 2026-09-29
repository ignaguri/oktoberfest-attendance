"use client";

import type { StorySlide, WrappedData } from "@prostcounter/shared/wrapped";

import { BadgesSlide } from "./slides/BadgesSlide";
import { BigNumberSlide } from "./slides/BigNumberSlide";
import { CompareSlide } from "./slides/CompareSlide";
import { DaysSlide } from "./slides/DaysSlide";
import { DrinksSlide } from "./slides/DrinksSlide";
import { PeopleSlide } from "./slides/PeopleSlide";
import { PersonaSlide } from "./slides/PersonaSlide";
import { ProstSlide } from "./slides/ProstSlide";
import { ServusSlide } from "./slides/ServusSlide";
import { TentsSlide } from "./slides/TentsSlide";
import { WiesnAndYouSlide } from "./slides/WiesnAndYouSlide";

interface StorySlideViewProps {
  slide: StorySlide;
  animate: boolean;
  data: WrappedData;
  onReplay: () => void;
  onClose: () => void;
}

export function StorySlideView({ slide, animate, data, onReplay, onClose }: StorySlideViewProps) {
  switch (slide.kind) {
    case "servus":
      return <ServusSlide slide={slide} animate={animate} />;
    case "bigNumber":
      return <BigNumberSlide slide={slide} animate={animate} />;
    case "drinks":
      return <DrinksSlide slide={slide} animate={animate} />;
    case "days":
      return <DaysSlide slide={slide} animate={animate} />;
    case "tents":
      return <TentsSlide slide={slide} animate={animate} />;
    case "people":
      return <PeopleSlide slide={slide} animate={animate} />;
    case "compare":
      return <CompareSlide slide={slide} animate={animate} />;
    case "wiesnAndYou":
      return <WiesnAndYouSlide slide={slide} animate={animate} />;
    case "badges":
      return <BadgesSlide slide={slide} animate={animate} />;
    case "persona":
      return <PersonaSlide slide={slide} animate={animate} />;
    case "prost":
      return <ProstSlide slide={slide} animate={animate} data={data} onReplay={onReplay} onClose={onClose} />;
  }
}
