import { cn } from "@prostcounter/ui";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import { useState } from "react";
import { Image, View } from "react-native";

import { VStack } from "@/components/ui/vstack";
import { getBeerPictureUrl } from "@/lib/image-urls";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryKicker, StoryStamp } from "../story-text";

const TILTS = ["-rotate-3", "rotate-2", "rotate-1", "-rotate-2"];

export function PeopleSlide({ slide, animate }: { slide: StorySlideOf<"people">; animate: boolean }) {
  const copy = useStoryCopy();
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const photos = slide.photos.filter((photo) => !failedIds.includes(photo.id));

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
        {slide.groups ? <StoryBody>{copy(slide.groups)}</StoryBody> : null}
      </Reveal>
      {slide.bestPlacing ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp className="py-2">{copy(slide.bestPlacing)}</StoryStamp>
        </Reveal>
      ) : null}
      {slide.photosLabel && photos.length > 0 ? (
        <Reveal step={2} animate={animate}>
          <StoryKicker className="mb-3">{copy(slide.photosLabel)}</StoryKicker>
          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo, index) => (
              <View key={photo.id} className={cn("rounded-md bg-white p-1.5", TILTS[index % TILTS.length])}>
                <Image
                  source={{ uri: getBeerPictureUrl(photo.pictureUrl) ?? "" }}
                  className="h-32 w-32 rounded"
                  onError={() => setFailedIds((ids) => [...ids, photo.id])}
                  // Decorative: the kicker above already announces this as a photo grid.
                  // alt alone makes RN treat the image as accessible/focusable, so it
                  // must be paired with aria-hidden to actually hide it from a11y.
                  alt=""
                  aria-hidden
                  importantForAccessibility="no"
                  accessibilityIgnoresInvertColors
                />
              </View>
            ))}
          </View>
        </Reveal>
      ) : null}
    </VStack>
  );
}
