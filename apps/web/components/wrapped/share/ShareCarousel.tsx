"use client";

import type { ShareLang } from "@prostcounter/shared";
import {
  useCreateWrappedShareLink,
  useRevokeWrappedShareLink,
  useWrappedShareLinks,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  isLinkableShareCardKind,
  type ShareCard,
  type ShareCardKind,
  useStoryCopy,
  type WrappedData,
} from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { WebShareCardState } from "./useWebShareCards";

const LOADING_LINES = [
  "wrapped.shareCards.carousel.loading1",
  "wrapped.shareCards.carousel.loading2",
  "wrapped.shareCards.carousel.loading3",
] as const;

function Placeholder({ card }: { card: ShareCard }) {
  const { t } = useTranslation();
  const copy = useStoryCopy();
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setLine((current) => (current + 1) % LOADING_LINES.length),
      1600,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="wrapped-paper flex h-full flex-col items-center justify-center px-4 motion-safe:animate-pulse">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-wrapped-ink/70">
        {copy(card.kicker)}
      </p>
      <p className="mt-3 text-center font-wrapped text-base font-extrabold text-wrapped-ink">
        {t(LOADING_LINES[line])}
      </p>
    </div>
  );
}

interface ShareCarouselProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  festivalId: string;
  lang: ShareLang;
  data: WrappedData;
  cards: ShareCard[];
  states: Partial<Record<ShareCardKind, WebShareCardState>>;
  onRetry: (kind: ShareCardKind) => void;
}

export function ShareCarousel({
  open,
  onOpenChange,
  festivalId,
  lang,
  data,
  cards,
  states,
  onRetry,
}: ShareCarouselProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const links = useWrappedShareLinks(open ? festivalId : undefined, lang);
  const createLink = useCreateWrappedShareLink(festivalId);
  const revokeLink = useRevokeWrappedShareLink(festivalId);

  const card = cards[index];
  const state = card ? states[card.kind] : undefined;
  const liveLink =
    links.data?.links.find((link) => link.kind === card?.kind) ?? null;

  const caption = useMemo(() => {
    const persona = cards.find((candidate) => candidate.kind === "persona");
    return [
      t("wrapped.shareCards.caption.title", {
        festival: data.festivalInfo.name,
      }),
      t("wrapped.shareCards.caption.stats", {
        beers: data.basicStats.totalBeers,
        days: data.basicStats.daysAttended,
      }),
      persona?.kind === "persona"
        ? t("wrapped.shareCards.caption.persona", { name: persona.name })
        : null,
      `#${data.festivalInfo.name.replace(/[^\p{L}\p{N}]/gu, "")} #ProstCounter`,
    ]
      .filter((line) => line !== null)
      .join("\n\n");
  }, [cards, data, t]);

  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (element && element.clientWidth > 0) {
      setIndex(Math.round(element.scrollLeft / element.clientWidth));
    }
  }, []);

  const onShare = useCallback(async () => {
    if (!card || state?.status !== "ready") {
      return;
    }
    const file = new File([state.blob], `prostcounter-${card.kind}.jpg`, {
      type: "image/jpeg",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(t("wrapped.shareCards.carousel.error"));
        }
      }
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = state.url;
    anchor.download = file.name;
    anchor.click();
  }, [caption, card, state, t]);

  const onCopyLink = useCallback(async () => {
    if (!card || !isLinkableShareCardKind(card.kind)) {
      return;
    }
    try {
      const link = await createLink.mutateAsync({ kind: card.kind, lang });
      await navigator.clipboard.writeText(link.url);
      toast.success(t("wrapped.shareCards.carousel.linkCopied"));
    } catch {
      toast.error(t("wrapped.shareCards.carousel.error"));
    }
  }, [card, createLink, lang, t]);

  const onStopSharing = useCallback(() => {
    if (
      liveLink &&
      window.confirm(t("wrapped.shareCards.carousel.stopSharingMessage"))
    ) {
      revokeLink.mutate(liveLink.token).catch(() => {
        toast.error(t("wrapped.shareCards.carousel.error"));
      });
    }
  }, [liveLink, revokeLink, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wrapped-paper max-w-md border-2 border-wrapped-ink">
        <DialogTitle className="font-wrapped text-2xl font-extrabold text-wrapped-ink">
          {t("wrapped.shareCards.carousel.title")}
        </DialogTitle>
        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto"
        >
          {cards.map((item, itemIndex) => {
            const itemState = states[item.kind];
            return (
              <div
                key={item.kind}
                className="flex w-full shrink-0 snap-center justify-center py-2"
              >
                <div
                  className="aspect-[9/16] w-3/5 overflow-hidden rounded-2xl border-2 border-wrapped-ink"
                  aria-label={t("wrapped.shareCards.carousel.cardLabel", {
                    index: itemIndex + 1,
                    total: cards.length,
                  })}
                >
                  {itemState?.status === "ready" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an optimizable asset
                    <img
                      src={itemState.url}
                      alt=""
                      className="h-full w-full motion-safe:animate-in motion-safe:fade-in"
                    />
                  ) : itemState?.status === "error" ? (
                    <div className="wrapped-paper flex h-full flex-col items-center justify-center gap-3 px-4">
                      <p className="text-center font-wrapped font-extrabold text-wrapped-ink">
                        {navigator.onLine
                          ? t("wrapped.shareCards.carousel.error")
                          : t("wrapped.shareCards.carousel.offline")}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRetry(item.kind)}
                        className="rounded-xl border-2 border-wrapped-ink px-4 py-2 text-sm font-bold text-wrapped-ink"
                      >
                        {t("wrapped.shareCards.carousel.retry")}
                      </button>
                    </div>
                  ) : (
                    <Placeholder card={item} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-2">
          {cards.map((item, dotIndex) => (
            <span
              key={item.kind}
              className={cn(
                "h-2 w-2 rounded-full",
                dotIndex === index ? "bg-wrapped-ink" : "bg-wrapped-ink/25",
              )}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onShare}
            disabled={state?.status !== "ready"}
            className={cn(
              "rounded-xl bg-wrapped-amber px-6 py-4 text-base font-bold text-wrapped-ink",
              state?.status !== "ready" && "opacity-50",
            )}
          >
            {t("wrapped.shareCards.carousel.share")}
          </button>
          {card && isLinkableShareCardKind(card.kind) ? (
            <button
              type="button"
              onClick={onCopyLink}
              disabled={createLink.loading}
              className="rounded-xl border-2 border-wrapped-ink px-6 py-3 text-base font-bold text-wrapped-ink"
            >
              {t("wrapped.shareCards.carousel.copyLink")}
            </button>
          ) : null}
          {liveLink ? (
            <button
              type="button"
              onClick={onStopSharing}
              className="px-6 py-2 text-sm text-wrapped-ink/70"
            >
              {t("wrapped.shareCards.carousel.stopSharing")}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
