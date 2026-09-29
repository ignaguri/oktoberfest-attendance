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
  type WrappedData,
  WRAPPED_STORY_THEME,
} from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { ShareCardState } from "@/hooks/useShareCards";
import { useIsOnline } from "@/lib/database/offline-provider";
import { logger } from "@/lib/logger";

import { PaperBackground } from "../story/paper-background";
import { ShareCardPreview } from "./share-card-preview";

/** Space around the card inside its page, in points. */
const PAGE_GUTTER = 24;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

interface ShareCarouselProps {
  visible: boolean;
  onClose: () => void;
  festivalId: string;
  lang: ShareLang;
  data: WrappedData;
  cards: ShareCard[];
  states: Partial<Record<ShareCardKind, ShareCardState>>;
  onRetry: (kind: ShareCardKind) => void;
}

export function ShareCarousel({
  visible,
  onClose,
  festivalId,
  lang,
  data,
  cards,
  states,
  onRetry,
}: ShareCarouselProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOnline = useIsOnline();
  const { dialog, showDialog, closeDialog } = useAlertDialog();
  const [index, setIndex] = useState(0);
  // The card fills whatever height the header, dots and buttons leave over
  const { width: screenWidth } = useWindowDimensions();
  const [pageHeight, setPageHeight] = useState(0);
  const cardWidth = Math.min(
    screenWidth - PAGE_GUTTER * 2,
    ((pageHeight - PAGE_GUTTER) * 9) / 16,
  );
  // Shown on the button itself: a toast or dialog in the root overlay would sit behind this Modal
  const [copyFeedback, setCopyFeedback] = useState<
    "linkCopied" | "error" | null
  >(null);
  const feedbackTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimerId.current) {
        clearTimeout(feedbackTimerId.current);
      }
    },
    [],
  );

  const flashCopyFeedback = useCallback((feedback: "linkCopied" | "error") => {
    setCopyFeedback(feedback);
    if (feedbackTimerId.current) {
      clearTimeout(feedbackTimerId.current);
    }
    feedbackTimerId.current = setTimeout(() => setCopyFeedback(null), 2000);
  }, []);

  // The list remounts on open, scrolled to the first card, so the index follows
  const handleClose = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);
  const links = useWrappedShareLinks(visible ? festivalId : undefined, lang);
  const createLink = useCreateWrappedShareLink(festivalId);
  const revokeLink = useRevokeWrappedShareLink(festivalId);

  const card = cards[index];
  const state = card ? states[card.kind] : undefined;
  const liveLink =
    links.data?.links.find((link) => link.kind === card?.kind) ?? null;
  const canLink = card ? isLinkableShareCardKind(card.kind) : false;

  const caption = useMemo(() => {
    const persona = cards.find((candidate) => candidate.kind === "persona");
    const hashtag = `#${data.festivalInfo.name.replace(/[^\p{L}\p{N}]/gu, "")} #ProstCounter`;
    return [
      t("wrapped.shareCards.caption.title", {
        festival: data.festivalInfo.name,
      }),
      t("wrapped.shareCards.caption.stats", {
        beers: t("wrapped.story.units.beers", {
          count: data.basicStats.totalBeers,
        }),
        count: data.basicStats.daysAttended,
      }),
      persona?.kind === "persona"
        ? t("wrapped.shareCards.caption.persona", { name: persona.name })
        : null,
      hashtag,
    ]
      .filter((line) => line !== null)
      .join("\n\n");
  }, [cards, data, t]);

  // FlatList rejects a new onViewableItemsChanged between renders, so it must stay stable
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ShareCard>[] }) => {
      const first = viewableItems[0];
      if (first?.index !== null && first?.index !== undefined) {
        setIndex(first.index);
      }
    },
    [],
  );

  const onShare = useCallback(async () => {
    if (state?.status !== "ready") {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        logger.warn("Sharing is not available on this device");
        return;
      }
      await Sharing.shareAsync(state.uri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle: caption,
      });
    } catch (error) {
      logger.error("Failed to share Wrapped card", error);
    }
  }, [caption, state]);

  const onCopyLink = useCallback(async () => {
    if (!card || !isLinkableShareCardKind(card.kind)) {
      return;
    }
    try {
      const link = await createLink.mutateAsync({ kind: card.kind, lang });
      await Clipboard.setStringAsync(link.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flashCopyFeedback("linkCopied");
    } catch (error) {
      logger.error("Failed to create Wrapped share link", error);
      flashCopyFeedback("error");
    }
  }, [card, createLink, flashCopyFeedback, lang]);

  const onStopSharing = useCallback(() => {
    if (!liveLink) {
      return;
    }
    showDialog(
      t("wrapped.shareCards.carousel.stopSharingTitle"),
      t("wrapped.shareCards.carousel.stopSharingMessage"),
      "destructive",
      () => {
        revokeLink.mutate(liveLink.token).catch((error: unknown) => {
          logger.error("Failed to stop sharing a Wrapped link", error);
        });
      },
    );
  }, [liveLink, revokeLink, showDialog, t]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-wrapped-paper">
        <PaperBackground />
        {/* SafeAreaView reads zero insets inside a sliding Modal, so pad by hand */}
        <View
          className="flex-1"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <HStack className="items-center justify-between px-6 pt-2">
            <Text className="font-wrapped text-2xl font-extrabold text-wrapped-ink">
              {t("wrapped.shareCards.carousel.title")}
            </Text>
            <Pressable
              onPress={handleClose}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel={t("wrapped.shareCards.carousel.close")}
            >
              <X size={24} color={WRAPPED_STORY_THEME.ink} />
            </Pressable>
          </HStack>

          <View
            className="flex-1"
            onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
          >
            <FlatList
              data={cards}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.kind}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={VIEWABILITY_CONFIG}
              renderItem={({ item, index: itemIndex }) => (
                <View
                  className="w-screen items-center justify-center"
                  style={{ height: pageHeight }}
                >
                  <ShareCardPreview
                    card={item}
                    state={states[item.kind]}
                    isOnline={isOnline}
                    label={t("wrapped.shareCards.carousel.cardLabel", {
                      index: itemIndex + 1,
                      total: cards.length,
                    })}
                    width={Math.max(cardWidth, 0)}
                    onRetry={() => onRetry(item.kind)}
                  />
                </View>
              )}
            />
          </View>

          <HStack className="justify-center gap-2 pb-4">
            {cards.map((item, dotIndex) => (
              <View
                key={item.kind}
                className={cn(
                  "h-2 w-2 rounded-full",
                  dotIndex === index ? "bg-wrapped-ink" : "bg-wrapped-ink/25",
                )}
              />
            ))}
          </HStack>

          <VStack space="md" className="px-6 pb-4">
            <Pressable
              onPress={onShare}
              disabled={state?.status !== "ready"}
              className={cn(
                "items-center rounded-xl px-6 py-4",
                state?.status === "ready"
                  ? "bg-wrapped-amber"
                  : "bg-wrapped-amber/50",
              )}
              accessibilityRole="button"
              accessibilityLabel={t("wrapped.shareCards.carousel.share")}
              accessibilityHint={t("wrapped.shareCards.carousel.shareHint")}
            >
              {state?.status === "loading" ? (
                <ActivityIndicator color={WRAPPED_STORY_THEME.ink} />
              ) : (
                <Text className="text-base font-bold text-wrapped-ink">
                  {t("wrapped.shareCards.carousel.share")}
                </Text>
              )}
            </Pressable>
            {/* Both links rows always take their space, so every card gets the same height */}
            <Pressable
              onPress={onCopyLink}
              disabled={!canLink || createLink.loading}
              className={cn(
                "items-center rounded-xl border-2 border-wrapped-ink px-6 py-3",
                !canLink && "opacity-0",
              )}
              accessibilityElementsHidden={!canLink}
              importantForAccessibility={
                canLink ? "auto" : "no-hide-descendants"
              }
              accessibilityRole="button"
              accessibilityLabel={t("wrapped.shareCards.carousel.copyLink")}
              accessibilityHint={t("wrapped.shareCards.carousel.copyLinkHint")}
            >
              <Text className="text-base font-bold text-wrapped-ink">
                {t(`wrapped.shareCards.carousel.${copyFeedback ?? "copyLink"}`)}
              </Text>
            </Pressable>
            <Pressable
              onPress={onStopSharing}
              disabled={!liveLink}
              className={cn("items-center px-6 py-2", !liveLink && "opacity-0")}
              accessibilityElementsHidden={!liveLink}
              importantForAccessibility={
                liveLink ? "auto" : "no-hide-descendants"
              }
              accessibilityRole="button"
              accessibilityLabel={t("wrapped.shareCards.carousel.stopSharing")}
            >
              <Text className="text-sm text-wrapped-ink/70">
                {t("wrapped.shareCards.carousel.stopSharing")}
              </Text>
            </Pressable>
          </VStack>
        </View>
      </View>
      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} useRNModal />
    </Modal>
  );
}
