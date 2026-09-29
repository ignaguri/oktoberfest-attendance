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
    <VStack space="xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <VStack space="sm">
          <StoryHeading className="text-center text-5xl">{copy(slide.title)}</StoryHeading>
          {slide.groups ? <StoryBody className="text-center text-4xl font-bold">{copy(slide.groups)}</StoryBody> : null}
        </VStack>
      </Reveal>
      {slide.bestPlacing ? (
        <Reveal step={1} animate={animate} kind="stamp">
          <StoryStamp numberOfLines={2} className="self-center py-2">{copy(slide.bestPlacing)}</StoryStamp>
        </Reveal>
      ) : null}
      {slide.photosLabel && photos.length > 0 ? (
        <Reveal step={2} animate={animate}>
          <StoryKicker className="mb-4 text-center text-sm">{copy(slide.photosLabel)}</StoryKicker>
          {/* Two columns across the full width, centred, so a lone last photo sits in the middle. */}
          <View className="flex-row flex-wrap justify-center gap-4">
            {photos.map((photo, index) => (
              <View key={photo.id} className={cn("w-[46%] rounded-md bg-white p-1.5", TILTS[index % TILTS.length])}>
                <Image
                  source={{ uri: getBeerPictureUrl(photo.pictureUrl) ?? "" }}
                  className="aspect-square w-full rounded"
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
