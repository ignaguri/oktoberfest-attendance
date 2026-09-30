import { useTranslation } from "@prostcounter/shared/i18n";
import { PERSONA_NAMES, type PersonaCardEntry, type PersonaId } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
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

const FLIP_MS = 500;
const FACE = "absolute inset-0 rounded-xl border-[3px] border-wrapped-ink p-3";

interface PersonaCardProps {
  card: PersonaCardEntry;
  total: number;
  /** Card width in px; height is width * 7 / 5 */
  width: number;
  onOpen: (personaId: PersonaId) => void;
}

/**
 * One persona card. Locked: silhouette + hint, not pressable. Unopened:
 * face-down with a NEW ribbon; pressing flips it face-up and calls onOpen
 * when the flip lands. Opened: pressing flips between front and back.
 */
export function PersonaCard({ card, total, width, onOpen }: PersonaCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [turned, setTurned] = useState(false);
  // A card dealt face-down lands on its front at 180°; keep that side the front
  // after the cache marks it opened, or it would jump to the back.
  const [dealtFaceDown] = useState(card.state === "unopened");
  const rotation = useSharedValue(0);
  const height = (width * 7) / 5;
  const name = PERSONA_NAMES[card.personaId];
  const hint = t(`wrapped.story.persona.${card.personaId}.hint`);

  const zeroStyle = useAnimatedStyle(() => ({
    backfaceVisibility: "hidden",
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const halfStyle = useAnimatedStyle(() => ({
    backfaceVisibility: "hidden",
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value + 180}deg` }],
  }));

  if (card.state === "locked") {
    return (
      <View
        style={{ width, height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("wrapped.personas.a11y.locked", { number: card.number, hint })}
      >
        <View className={cn(FACE, "items-center border-dashed bg-wrapped-paper")}>
          <Text className="self-start text-xs font-bold text-wrapped-ink">
            {t("wrapped.personas.number", { number: card.number })}
          </Text>
          <View className="my-2">
            <Crest personaId={card.personaId} size="md" silhouette />
          </View>
          <Text className="rounded border border-dashed border-wrapped-ink px-3 py-1 text-sm font-bold text-wrapped-ink">
            {t("wrapped.personas.lockedName")}
          </Text>
          <VStack className="mt-auto items-center">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-wrapped-ink/60">
              {t("wrapped.personas.howToEarn")}
            </Text>
            <Text className="text-center text-sm font-bold text-wrapped-ink">{hint}</Text>
          </VStack>
        </View>
      </View>
    );
  }

  const front: ReactNode = (
    <View className={cn(FACE, "items-center bg-wrapped-paper")}>
      <Text className="self-start text-xs font-bold text-wrapped-ink">
        {t("wrapped.personas.number", { number: card.number })}
      </Text>
      <View className="my-2">
        <Crest personaId={card.personaId} size="md" />
      </View>
      <Text className="rounded bg-wrapped-ink px-3 py-1 text-sm font-bold text-wrapped-paper">{name}</Text>
      <Text className="mt-auto text-xs font-semibold text-wrapped-blue">{card.festivals[0]?.name}</Text>
    </View>
  );

  const back: ReactNode = (
    <VStack space="sm" className={cn(FACE, "bg-wrapped-ink")}>
      <Text className="font-wrapped text-lg font-extrabold text-wrapped-paper">{name}</Text>
      <Text className="font-wrapped text-sm italic text-wrapped-paper/90">
        {t(`wrapped.story.persona.${card.personaId}.description`)}
      </Text>
      <Text className="text-[10px] font-extrabold uppercase tracking-wider text-wrapped-amber">
        {t("wrapped.personas.howToEarn")}
      </Text>
      <Text className="text-sm font-semibold text-wrapped-paper">{hint}</Text>
      <Text className="text-[10px] font-extrabold uppercase tracking-wider text-wrapped-amber">
        {t("wrapped.personas.collectedAt")}
      </Text>
      <HStack space="xs" className="flex-wrap">
        {card.festivals.map((festival) => (
          <Text
            key={festival.festivalId}
            className="rounded-full bg-wrapped-paper/15 px-2 py-0.5 text-xs font-semibold text-wrapped-paper"
          >
            {festival.name}
          </Text>
        ))}
      </HStack>
      <Text className="mt-auto text-center text-xs font-bold text-wrapped-paper/60">
        {t("wrapped.personas.numberOfTotal", { number: card.number, total })}
      </Text>
    </VStack>
  );

  const faceDown: ReactNode = (
    <View className={cn(FACE, "items-center justify-center bg-wrapped-ink")}>
      <Text className="absolute -right-2 top-3 rotate-6 rounded-sm bg-wrapped-amber px-2 py-0.5 text-xs font-black uppercase tracking-wider text-wrapped-ink">
        {t("wrapped.personas.new")}
      </Text>
      <View className="h-14 w-14 items-center justify-center rounded-full border-[3px] border-wrapped-paper bg-wrapped-amber">
        <Text className="text-2xl font-black text-wrapped-ink">?</Text>
      </View>
      <Text className="absolute bottom-3 text-xs font-bold text-wrapped-paper">{t("wrapped.personas.tapToOpen")}</Text>
    </View>
  );

  const isUnopened = card.state === "unopened";
  let zeroFace = front;
  let halfFace = back;
  if (isUnopened) {
    zeroFace = faceDown;
    halfFace = front;
  } else if (dealtFaceDown) {
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
      if (reduceMotion) {
        notifyOpened();
        return;
      }
      rotation.value = withTiming(180, { duration: FLIP_MS }, (finished) => {
        if (finished) {
          scheduleOnRN(notifyOpened);
        }
      });
      return;
    }
    const next = !turned;
    setTurned(next);
    if (!reduceMotion) {
      rotation.value = withTiming(next ? 180 : 0, { duration: FLIP_MS });
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
      accessibilityHint={isUnopened ? t("wrapped.personas.a11y.openHint") : t("wrapped.personas.a11y.flipHint")}
    >
      <View className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl bg-wrapped-ink" />
      {reduceMotion ? (
        <View className="absolute inset-0">{turned ? halfFace : zeroFace}</View>
      ) : (
        <>
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
