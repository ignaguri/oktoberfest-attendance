import { useTranslation } from "@prostcounter/shared/i18n";
import {
  initialStoryState,
  revealDurationMs,
  type StorySlide,
  storyReducer,
  useSlideSummary,
  useStoryLanguage,
  WRAPPED_STORY_THEME,
  type WrappedData,
  type WrappedShareContext,
} from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { useEffect, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareCarousel } from "@/components/wrapped/share/share-carousel";
import { useShareCards } from "@/hooks/useShareCards";

import { PaperBackground } from "./paper-background";
import { StorySlideView } from "./story-slide";

interface StoryShellProps {
  data: WrappedData;
  slides: StorySlide[];
  share: WrappedShareContext;
  onClose: () => void;
}

/**
 * Tap-only story: left third goes back, the rest goes forward. The tap zones
 * sit under the slide content, which ignores touches except on the last slide.
 */
export function StoryShell({ data, slides, share, onClose }: StoryShellProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [state, dispatch] = useReducer(storyReducer, slides.length, initialStoryState);
  const slide = slides[state.index];
  const hasMoved = useRef(false);
  const summary = useSlideSummary(slide);
  const progressLabel = t("wrapped.story.a11y.progress", { current: state.index + 1, total: slides.length });

  useEffect(() => {
    if (state.revealComplete) {
      return;
    }
    if (reduceMotion) {
      dispatch({ type: "revealDone" });
      return;
    }
    const timerId = setTimeout(() => dispatch({ type: "revealDone" }), revealDurationMs(slide.revealSteps));
    return () => clearTimeout(timerId);
  }, [state.index, state.revealComplete, reduceMotion, slide.revealSteps]);

  useEffect(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [state.index]);

  // The tap zones are the only focus targets a slide change leaves behind, so a
  // screen reader would hear nothing new on "Next" without this.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${progressLabel}. ${summary}`);
  }, [progressLabel, summary]);

  const animate = !reduceMotion && !state.revealComplete;
  const isLast = slide.kind === "prost";
  const lang = useStoryLanguage();
  // Held here, not in the Prost slide: the slide remounts when its reveal ends
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [reachedProst, setReachedProst] = useState(false);
  const shareCards = useShareCards({
    festivalId: share.festivalId,
    data,
    officialStats: share.officialStats,
    lang,
    enabled: reachedProst,
  });

  useEffect(() => {
    if (isLast) {
      setReachedProst(true);
    }
  }, [isLast]);

  return (
    <View className="flex-1">
      <PaperBackground />

      <Pressable
        className="absolute bottom-0 left-0 top-0 w-1/3"
        onPress={() => dispatch({ type: "prev" })}
        accessibilityRole="button"
        accessibilityLabel={t("wrapped.story.a11y.prev")}
        accessibilityHint={t("wrapped.story.a11y.prevHint")}
      />
      <Pressable
        className="absolute bottom-0 right-0 top-0 w-2/3"
        onPress={() => dispatch({ type: "next" })}
        accessibilityRole="button"
        accessibilityLabel={t("wrapped.story.a11y.next")}
        accessibilityHint={t("wrapped.story.a11y.nextHint")}
      />

      <View
        className="flex-1 px-6"
        style={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }}
        pointerEvents={isLast ? "box-none" : "none"}
      >
        {/* One accessible summary per slide; the Prost slide stays open so its buttons remain reachable. */}
        <View
          key={`${state.index}-${animate ? "animating" : "done"}`}
          className="flex-1"
          pointerEvents="box-none"
          accessible={!isLast}
          accessibilityLabel={isLast ? undefined : summary}
        >
          <StorySlideView
            slide={slide}
            animate={animate}
            onShare={() => setCarouselOpen(true)}
            onReplay={() => dispatch({ type: "replay" })}
            onClose={onClose}
          />
        </View>
      </View>

      <View
        className="absolute left-4 right-4 flex-row gap-1"
        style={{ top: insets.top + 12 }}
        pointerEvents="none"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={progressLabel}
      >
        {slides.map((item, index) => (
          <View
            key={`${item.kind}-${index}`}
            className={cn("h-1 flex-1 rounded-full", index <= state.index ? "bg-wrapped-ink" : "bg-wrapped-ink/20")}
          />
        ))}
      </View>

      <Pressable
        onPress={onClose}
        className="absolute right-3 rounded-full p-2"
        style={{ top: insets.top + 22 }}
        accessibilityRole="button"
        accessibilityLabel={t("wrapped.close")}
        accessibilityHint={t("wrapped.story.a11y.closeHint")}
      >
        <X size={24} color={WRAPPED_STORY_THEME.ink} />
      </Pressable>

      <ShareCarousel
        visible={carouselOpen}
        onClose={() => setCarouselOpen(false)}
        festivalId={share.festivalId}
        lang={lang}
        data={data}
        cards={shareCards.cards}
        states={shareCards.states}
        onRetry={shareCards.retry}
      />
    </View>
  );
}
