import type { StorySlide, WrappedData } from "@prostcounter/shared/wrapped";

import { BadgesSlide } from "./slides/badges-slide";
import { BigNumberSlide } from "./slides/big-number-slide";
import { CompareSlide } from "./slides/compare-slide";
import { DaysSlide } from "./slides/days-slide";
import { DrinksSlide } from "./slides/drinks-slide";
import { PeopleSlide } from "./slides/people-slide";
import { PersonaSlide } from "./slides/persona-slide";
import { ProstSlide } from "./slides/prost-slide";
import { ServusSlide } from "./slides/servus-slide";
import { TentsSlide } from "./slides/tents-slide";
import { WiesnAndYouSlide } from "./slides/wiesn-and-you-slide";

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
