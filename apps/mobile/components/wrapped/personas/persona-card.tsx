import { useTranslation } from "@prostcounter/shared/i18n";
import type { PersonaCardEntry, PersonaId } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { Crest } from "../story/crest";

const FLIP_MS = 600;
const FLIP_EASING = Easing.inOut(Easing.cubic);
/** How much the card lifts toward the viewer at the middle of a flip */
const FLIP_LIFT = 0.08;
const FACE = "absolute inset-0 overflow-hidden rounded-2xl border-[3px] border-wrapped-ink p-4";
// The story's rhombus paper as an image tile: an Svg pattern mounted inside
// the turned face renders only a corner of itself on iOS
const RHOMBUS_TILE = require("@/assets/wrapped/rhombus-tile.png");
/** A locked card also fits the hint, which can run to two lines */
const LOCKED_CREST_SCALE = 0.8;
const SHADOW = "absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl";
/** An ink shadow disappears into a navy face, so dark faces cast amber */
const PAPER_SHADOW = cn(SHADOW, "bg-wrapped-ink");
const INK_SHADOW = cn(SHADOW, "bg-wrapped-amber");

interface PersonaCardProps {
  card: PersonaCardEntry;
  total: number;
  /** From personaCardSize: the card and its crest in px */
  size: { width: number; height: number; crest: number };
  onOpen: (personaId: PersonaId) => void;
}

/**
 * One persona card. Locked: silhouette + hint, not pressable. Unopened:
 * face-down with a NEW ribbon; pressing flips it face-up and calls onOpen
 * when the flip lands. Opened: pressing flips between front and back.
 */
export function PersonaCard({ card, total, size, onOpen }: PersonaCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [turned, setTurned] = useState(false);
  // A card revealed here lands on its front at 180°; keep that side the front
  // after the cache marks it opened, or it would jump to the back.
  const [revealedHere, setRevealedHere] = useState(false);
  const [previousState, setPreviousState] = useState(card.state);
  if (card.state !== previousState) {
    setPreviousState(card.state);
    // The open failed and the cache rolled back: deal the card face-down again
    if (previousState === "opened" && card.state === "unopened") {
      setTurned(false);
      setRevealedHere(false);
    }
  }
  const rotation = useSharedValue(0);
  const { width, height } = size;
  const name = card.name;
  const hint = t(`wrapped.story.persona.${card.personaId}.hint`);

  const isFaceDown = card.state === "unopened" && !turned;
  useEffect(() => {
    if (isFaceDown) {
      rotation.value = reduceMotion ? 0 : withTiming(0, { duration: FLIP_MS, easing: FLIP_EASING });
    }
  }, [isFaceDown, reduceMotion, rotation]);

  // iOS still draws a face's children past 90° even with backfaceVisibility
  // hidden, so each face is shown only while it faces the viewer.
  const zeroStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [
      { perspective: 1000 },
      { scale: 1 + FLIP_LIFT * Math.sin((rotation.value * Math.PI) / 180) },
      { rotateY: `${rotation.value}deg` },
    ],
  }));
  const halfStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 0 : 1,
    transform: [
      { perspective: 1000 },
      { scale: 1 + FLIP_LIFT * Math.sin((rotation.value * Math.PI) / 180) },
      { rotateY: `${rotation.value + 180}deg` },
    ],
  }));

  if (card.state === "locked") {
    return (
      <View
        style={{ width, height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("wrapped.personas.a11y.locked", {
          number: card.number,
          hint,
        })}
      >
        <View className={cn(FACE, "items-center border-dashed bg-wrapped-paper")}>
          <Text className="self-start text-sm font-bold text-wrapped-ink/60">
            {t("wrapped.personas.number", { number: card.number })}
          </Text>
          <View className="flex-1 items-center justify-center">
            <Crest
              personaId={card.personaId}
              width={Math.round(size.crest * LOCKED_CREST_SCALE)}
              silhouette
            />
          </View>
          <Text className="rounded-md border-2 border-dashed border-wrapped-ink/60 px-4 py-1 font-wrapped text-xl font-bold text-wrapped-ink/60">
            {t("wrapped.personas.lockedName")}
          </Text>
          <VStack space="xs" className="mt-4 items-center">
            <Text className="text-xs font-extrabold uppercase tracking-wider text-wrapped-ink/60">
              {t("wrapped.personas.howToEarn")}
            </Text>
            <Text className="text-center text-base font-bold text-wrapped-ink">{hint}</Text>
          </VStack>
        </View>
      </View>
    );
  }

  const front: ReactNode = (
    <>
      <View className={PAPER_SHADOW} />
      <View className={cn(FACE, "items-center bg-wrapped-paper")}>
        <Image
          source={RHOMBUS_TILE}
          resizeMode="repeat"
          className="absolute inset-0 h-full w-full"
          alt=""
          aria-hidden
          importantForAccessibility="no"
        />
        <Text className="self-start text-sm font-bold text-wrapped-ink">
          {t("wrapped.personas.number", { number: card.number })}
        </Text>
        <View className="flex-1 items-center justify-center">
          <Crest personaId={card.personaId} width={size.crest} />
        </View>
        <Text className="-rotate-2 rounded-md bg-wrapped-ink px-5 py-1.5 font-wrapped text-2xl font-extrabold text-wrapped-paper">
          {name}
        </Text>
        <Text className="mt-4 text-sm font-semibold text-wrapped-blue">
          {card.festivals[0]?.name}
        </Text>
      </View>
    </>
  );

  const back: ReactNode = (
    <>
      <View className={INK_SHADOW} />
      <VStack space="md" className={cn(FACE, "bg-wrapped-ink p-5")}>
        <Text className="font-wrapped text-3xl font-extrabold text-wrapped-paper">{name}</Text>
        <Text className="font-wrapped text-lg italic text-wrapped-paper/90">
          {t(card.descriptionKey)}
        </Text>
        <Text className="mt-2 text-xs font-extrabold uppercase tracking-wider text-wrapped-amber">
          {t("wrapped.personas.howToEarn")}
        </Text>
        <Text className="text-base font-semibold text-wrapped-paper">{hint}</Text>
        <Text className="mt-2 text-xs font-extrabold uppercase tracking-wider text-wrapped-amber">
          {t("wrapped.personas.collectedAt")}
        </Text>
        <HStack space="xs" className="flex-wrap">
          {card.festivals.map((festival) => (
            <Text
              key={festival.festivalId}
              className="rounded-full bg-wrapped-paper/15 px-3 py-1 text-sm font-semibold text-wrapped-paper"
            >
              {festival.name}
            </Text>
          ))}
        </HStack>
        <Text className="mt-auto text-center text-sm font-bold text-wrapped-paper/60">
          {t("wrapped.personas.numberOfTotal", { number: card.number, total })}
        </Text>
      </VStack>
    </>
  );

  const faceDown: ReactNode = (
    <>
      <View className={INK_SHADOW} />
      <View className={cn(FACE, "items-center justify-center bg-wrapped-ink")}>
        <Text className="absolute right-3 top-4 rotate-6 rounded-sm bg-wrapped-amber px-2.5 py-1 text-sm font-black uppercase tracking-wider text-wrapped-ink">
          {t("wrapped.personas.new")}
        </Text>
        <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-wrapped-paper bg-wrapped-amber">
          <Text className="text-5xl font-black text-wrapped-ink">?</Text>
        </View>
        <Text className="absolute bottom-5 text-base font-bold text-wrapped-paper">
          {t("wrapped.personas.tapToOpen")}
        </Text>
      </View>
    </>
  );

  const isUnopened = card.state === "unopened";
  let zeroFace = front;
  let halfFace = back;
  if (isUnopened) {
    zeroFace = faceDown;
    halfFace = front;
  } else if (revealedHere) {
    zeroFace = back;
    halfFace = front;
  }

  const notifyOpened = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onOpen(card.personaId);
  };

  const onPress = () => {
    if (isUnopened) {
      if (turned) {
        return;
      }
      setTurned(true);
      setRevealedHere(true);
      if (reduceMotion) {
        notifyOpened();
        return;
      }
      rotation.value = withTiming(180, { duration: FLIP_MS, easing: FLIP_EASING }, (finished) => {
        if (finished) {
          scheduleOnRN(notifyOpened);
        }
      });
      return;
    }
    const next = !turned;
    setTurned(next);
    if (!reduceMotion) {
      rotation.value = withTiming(next ? 180 : 0, {
        duration: FLIP_MS,
        easing: FLIP_EASING,
      });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={{ width, height }}
      accessibilityRole="button"
      accessibilityLabel={
        isUnopened
          ? t("wrapped.personas.a11y.unopened", { number: card.number })
          : t("wrapped.personas.a11y.opened", { number: card.number, name })
      }
      accessibilityHint={
        isUnopened ? t("wrapped.personas.a11y.openHint") : t("wrapped.personas.a11y.flipHint")
      }
    >
      {reduceMotion ? (
        <View className="absolute inset-0">{turned ? halfFace : zeroFace}</View>
      ) : (
        <>
          {/* Each face carries its own shadow so it turns with the card. The
              half face ends at 360°, unmirrored, so its shadow sits the same way. */}
          <Animated.View className="absolute inset-0" style={zeroStyle}>
            {zeroFace}
          </Animated.View>
          <Animated.View className="absolute inset-0" style={halfStyle}>
            {halfFace}
          </Animated.View>
        </>
      )}
    </Pressable>
  );
}
