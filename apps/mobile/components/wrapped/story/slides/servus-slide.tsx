import { formatWrappedDate, type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { Image } from "react-native";

import { VStack } from "@/components/ui/vstack";
import { getAvatarUrl } from "@/lib/image-urls";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryStamp } from "../story-text";

export function ServusSlide({ slide, animate }: { slide: StorySlideOf<"servus">; animate: boolean }) {
  const copy = useStoryCopy();
  const avatarUri = getAvatarUrl(slide.avatarUrl);

  return (
    <VStack space="xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryStamp>{`${formatWrappedDate(slide.startDate)} – ${formatWrappedDate(slide.endDate)}`}</StoryStamp>
      </Reveal>
      {avatarUri ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <Image
            source={{ uri: avatarUri }}
            className="h-24 w-24 rounded-full border-4 border-wrapped-ink"
            // Decorative: the greeting and title next to it carry the meaning.
            // alt alone makes RN treat the image as accessible/focusable, so it
            // must be paired with aria-hidden to actually hide it from a11y.
            alt=""
            aria-hidden
            importantForAccessibility="no"
            accessibilityIgnoresInvertColors
          />
        </Reveal>
      ) : null}
      <Reveal step={2} animate={animate}>
        <StoryHeading numberOfLines={2} className="text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={3} animate={animate}>
        <StoryBody>{copy(slide.subtitle)}</StoryBody>
      </Reveal>
    </VStack>
  );
}
