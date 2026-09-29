"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import {
  initialStoryState,
  revealDurationMs,
  type StorySlide,
  storyReducer,
  useSlideSummary,
  useStoryLanguage,
  type WrappedData,
  type WrappedShareContext,
} from "@prostcounter/shared/wrapped";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useReducer, useState } from "react";

import { cn } from "@/lib/utils";

import { ShareCarousel } from "../share/ShareCarousel";
import { useWebShareCards } from "../share/useWebShareCards";
import { StorySlideView } from "./StorySlide";

interface StoryShellProps {
  data: WrappedData;
  slides: StorySlide[];
  share: WrappedShareContext;
  onClose: () => void;
}

/**
 * Tap-only story overlay. Left third goes back, the rest forward; arrows and
 * Space too, Escape closes. The zones sit under the content, which ignores
 * pointer events except the Prost slide's buttons.
 */
export function StoryShell({ data, slides, share, onClose }: StoryShellProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const [state, dispatch] = useReducer(storyReducer, slides.length, initialStoryState);
  const slide = slides[state.index];
  const summary = useSlideSummary(slide);
  const isLast = slide.kind === "prost";
  const lang = useStoryLanguage();
  // Held here, not in the Prost slide: the slide remounts when its reveal ends
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [reachedProst, setReachedProst] = useState(false);
  const shareCards = useWebShareCards({
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

  useEffect(() => {
    if (state.revealComplete) {
      return;
    }
    if (reduceMotion) {
      dispatch({ type: "revealDone" });
      return;
    }
    const timerId = window.setTimeout(() => dispatch({ type: "revealDone" }), revealDurationMs(slide.revealSteps));
    return () => window.clearTimeout(timerId);
  }, [state.index, state.revealComplete, reduceMotion, slide.revealSteps]);

  useEffect(() => {
    // The carousel dialog handles its own keys; Escape there must not close the story
    if (carouselOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      // Space on a focused Share/Replay/Close button presses that button
      const onControl = event.target instanceof HTMLElement && event.target.closest("button, a") !== null;
      if (event.key === "ArrowRight" || (event.key === " " && !onControl)) {
        event.preventDefault();
        dispatch({ type: "next" });
      } else if (event.key === "ArrowLeft") {
        dispatch({ type: "prev" });
      } else if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [carouselOpen, onClose]);

  const animate = !reduceMotion && !state.revealComplete;

  return (
    <div className="wrapped-paper fixed inset-0 z-50">
      <div className="relative mx-auto h-full w-full max-w-md">
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => dispatch({ type: "prev" })}
          aria-label={t("wrapped.story.a11y.prev")}
          title={t("wrapped.story.a11y.prevHint")}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => dispatch({ type: "next" })}
          aria-label={t("wrapped.story.a11y.next")}
          title={t("wrapped.story.a11y.nextHint")}
        />

        {/* relative: a static box paints under the absolute zones, whatever the DOM order */}
        <div className="pointer-events-none relative flex h-full flex-col px-6 pt-20 pb-8">
          {/* Screen readers get the slide from the live region below; Prost stays exposed for its buttons. */}
          <div
            key={`${state.index}-${animate ? "animating" : "done"}`}
            className="flex flex-1 flex-col"
            aria-hidden={isLast ? undefined : true}
          >
            <StorySlideView
              slide={slide}
              animate={animate}
              onShare={() => setCarouselOpen(true)}
              onReplay={() => dispatch({ type: "replay" })}
              onClose={onClose}
            />
          </div>
        </div>

        <output aria-live="polite" className="sr-only">
          {`${t("wrapped.story.a11y.progress", { current: state.index + 1, total: slides.length })}. ${summary}`}
        </output>

        <div className="pointer-events-none absolute top-4 right-4 left-4 flex gap-1" aria-hidden>
          {slides.map((item, index) => (
            <span
              key={`${item.kind}-${index}`}
              className={cn("h-1 flex-1 rounded-full", index <= state.index ? "bg-wrapped-ink" : "bg-wrapped-ink/20")}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-8 right-3 rounded-full p-2 text-wrapped-ink"
          aria-label={t("wrapped.close")}
          title={t("wrapped.story.a11y.closeHint")}
        >
          <X className="size-6" />
        </button>
      </div>

      <ShareCarousel
        open={carouselOpen}
        onOpenChange={setCarouselOpen}
        festivalId={share.festivalId}
        lang={lang}
        data={data}
        cards={shareCards.cards}
        states={shareCards.states}
        onRetry={shareCards.retry}
      />
    </div>
  );
}
