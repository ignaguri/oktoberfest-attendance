import { cn } from "@prostcounter/ui";
import {
  REVEAL_STEP_MS,
  type StatCard,
  type StorySlideOf,
  useCountUp,
  useStoryCopy,
  useStoryLanguage,
} from "@prostcounter/shared/wrapped";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryKicker, StoryNote } from "../story-text";

/** Big cards: the crowd and your share. Navy, amber figures, tilted like the compare cards. */
const BIG_TILTS = ["-rotate-2", "rotate-2"];
/** Small cards: the fun facts. Amber, leaning the other way. */
const SMALL_TILTS = ["rotate-3", "-rotate-3"];
const FIND_TILTS = ["-rotate-3", "rotate-2", "-rotate-1"];

export function WiesnAndYouSlide({ slide, animate }: { slide: StorySlideOf<"wiesnAndYou">; animate: boolean }) {
  const copy = useStoryCopy();
  const language = useStoryLanguage();
  const bigCards = [slide.visitors, slide.share].filter((card): card is StatCard => card !== null);
  const smallCards = [slide.mugs, slide.lostAndFound].filter((card): card is StatCard => card !== null);
  // Steps follow what is shown: kicker, each big card, the small row, the finds.
  const smallStep = 1 + bigCards.length;
  const findsStep = smallStep + (smallCards.length > 0 ? 1 : 0);
  // The mugs count up once their card is in, as they did on their own slide.
  const mugs = useCountUp(Number(slide.mugs?.stat.params?.mugs ?? 0), animate, 1200, smallStep * REVEAL_STEP_MS);
  const statOf = (card: StatCard) =>
    card === slide.mugs ? copy({ ...card.stat, params: { mugs: Math.round(mugs) } }) : copy(card.stat);

  return (
    <VStack space="xl" className="flex-1 justify-center pb-16">
      <Reveal step={0} animate={animate}>
        <StoryKicker className="text-center text-sm">{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      {bigCards.map((card, index) => (
        <Reveal key={card.caption.key} step={index + 1} animate={animate}>
          <VStack
            space="xs"
            className={cn("mx-4 rounded-2xl bg-wrapped-ink px-5 py-4", BIG_TILTS[index % BIG_TILTS.length])}
          >
            <StoryBig className="text-center text-4xl text-wrapped-amber">{copy(card.stat)}</StoryBig>
            <StoryBody className="text-center text-base leading-snug text-wrapped-paper">{copy(card.caption)}</StoryBody>
          </VStack>
        </Reveal>
      ))}
      {smallCards.length > 0 ? (
        <Reveal step={smallStep} animate={animate}>
          <HStack space="md" className="px-2">
            {smallCards.map((card, index) => (
              <VStack
                key={card.caption.key}
                className={cn("flex-1 rounded-xl bg-wrapped-amber px-3 py-3", SMALL_TILTS[index % SMALL_TILTS.length])}
              >
                <StoryBig className="text-center text-3xl">{statOf(card)}</StoryBig>
                <StoryBody className="text-center text-sm leading-snug">{copy(card.caption)}</StoryBody>
              </VStack>
            ))}
          </HStack>
        </Reveal>
      ) : null}
      {slide.finds.length > 0 ? (
        <Reveal step={findsStep} animate={animate}>
          <VStack space="sm" className="items-center">
            <StoryKicker className="text-center">{copy(slide.findsLabel)}</StoryKicker>
            <View className="flex-row flex-wrap justify-center gap-2">
              {slide.finds.map((find, index) => (
                <View
                  key={`${index}-${find.en}`}
                  className={cn(
                    "rounded-md border-2 border-wrapped-ink bg-white px-3 py-1.5",
                    FIND_TILTS[index % FIND_TILTS.length],
                  )}
                >
                  <Text className="text-sm font-bold text-wrapped-ink">{find[language] ?? find.en}</Text>
                </View>
              ))}
            </View>
          </VStack>
        </Reveal>
      ) : null}
      <VStack space="xs" className="absolute bottom-0 left-0 right-0">
        {slide.checkBack ? <StoryNote className="text-center text-wrapped-ink">{copy(slide.checkBack)}</StoryNote> : null}
        <StoryNote className="text-center">{copy(slide.source)}</StoryNote>
      </VStack>
    </VStack>
  );
}
