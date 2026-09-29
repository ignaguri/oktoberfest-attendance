import { cn } from "@prostcounter/ui";
import {
  formatWrappedDate,
  formatWrappedShortDate,
  type StorySlideOf,
  useStoryCopy,
  WRAPPED_STORY_THEME,
} from "@prostcounter/shared/wrapped";
import { Tent } from "lucide-react-native";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryNote, StoryStamp } from "../story-text";

/** One dot per beer, as on the drinks slide; taller days end in a "+". */
const MAX_COLUMN_DOTS = 12;
/** A faint track keeps light festivals from looking like a flat line. */
const MIN_TRACK_DOTS = 4;
/** Past this many days a 10px dot no longer fits its column (a month-long Volksfest). */
const LARGE_DOT_MAX_DAYS = 24;
/** One tent icon per tent visited; nobody really does more than two a day. */
const MAX_TENT_ICONS = 3;

export function DaysSlide({ slide, animate }: { slide: StorySlideOf<"days">; animate: boolean }) {
  const copy = useStoryCopy();
  const trackDots = Math.min(Math.max(slide.maxBeers, MIN_TRACK_DOTS), MAX_COLUMN_DOTS);
  const firstDate = slide.bars[0]?.date;
  const lastDate = slide.bars[slide.bars.length - 1]?.date;
  // Not aspect-square + max-w: React Native sizes the height before the max-width clamp.
  const isLongFestival = slide.bars.length > LARGE_DOT_MAX_DAYS;
  const dotSize = isLongFestival ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  const tentSize = isLongFestival ? 8 : 16;
  const tentSlot = isLongFestival ? "h-2 w-2" : "h-4 w-4";
  const tentRows = Math.min(Math.max(0, ...slide.bars.map((bar) => bar.tents)), MAX_TENT_ICONS);
  // Like the beer "+": one extra slot in every column, so the columns stay the same height.
  const hasTentOverflow = slide.bars.some((bar) => bar.tents > MAX_TENT_ICONS);

  return (
    <VStack space="xl" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-center text-5xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <VStack space="sm">
          <HStack className="items-end justify-between">
            {slide.bars.map((bar) => {
              const filled = Math.min(bar.beers, MAX_COLUMN_DOTS);
              const isBest = bar.date === slide.bestDay?.date;
              return (
                <VStack
                  key={bar.date}
                  space="xs"
                  className={cn(
                    "mx-px min-w-0 flex-1 items-center rounded-md border py-1",
                    bar.attended ? "border-dotted border-wrapped-ink/50" : "border-transparent",
                  )}
                >
                  {bar.beers > MAX_COLUMN_DOTS ? (
                    <StoryNote className="text-xs font-bold text-wrapped-ink">+</StoryNote>
                  ) : null}
                  {Array.from({ length: trackDots }, (_, index) => (
                    <View
                      key={index}
                      className={cn(
                        "rounded-full",
                        dotSize,
                        trackDots - index > filled
                          ? "bg-wrapped-ink/10"
                          : isBest
                            ? "bg-wrapped-amber"
                            : "bg-wrapped-ink",
                      )}
                    />
                  ))}
                  {/* Same slot count in every column, so a two-tent day doesn't lift its dots. */}
                  {/* The fixed box, not the icon, sets the height: the Svg renders a touch taller than its size. */}
                  {Array.from({ length: tentRows }, (_, index) => (
                    <View key={`tent-${index}`} className={cn("items-center justify-center overflow-hidden", tentSlot)}>
                      {index < bar.tents ? (
                        <Tent size={tentSize} color={WRAPPED_STORY_THEME.stampAmber} strokeWidth={2.5} />
                      ) : null}
                    </View>
                  ))}
                  {hasTentOverflow ? (
                    <View className={cn("items-center justify-center overflow-hidden", tentSlot)}>
                      {bar.tents > MAX_TENT_ICONS ? (
                        <StoryNote className="text-sm font-extrabold leading-none text-wrapped-amber">+</StoryNote>
                      ) : null}
                    </View>
                  ) : null}
                </VStack>
              );
            })}
          </HStack>
          {firstDate && lastDate ? (
            <HStack className="justify-between">
              <StoryNote className="text-sm">{formatWrappedShortDate(firstDate)}</StoryNote>
              <StoryNote className="text-sm">{formatWrappedShortDate(lastDate)}</StoryNote>
            </HStack>
          ) : null}
        </VStack>
      </Reveal>
      {slide.bestDay ? (
        <Reveal step={2} animate={animate}>
          <VStack space="md" className="items-center">
            <StoryStamp className="self-center">{formatWrappedDate(slide.bestDay.date)}</StoryStamp>
            <StoryBody className="text-center text-2xl font-bold">
              {`${copy(slide.bestDay.callout)} ${copy(slide.bestDay.details)}`}
            </StoryBody>
          </VStack>
        </Reveal>
      ) : null}
    </VStack>
  );
}
