import type { ShareLang } from "@prostcounter/shared";
import { useApiClient } from "@prostcounter/shared/data";
import {
  buildShareCards,
  createLatestRequestGate,
  type ShareCard,
  type ShareCardKind,
  shareCardFingerprint,
  type WrappedData,
  type WrappedOfficialStats,
} from "@prostcounter/shared/wrapped";
import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useMemo, useState } from "react";

import { logger } from "@/lib/logger";

export type ShareCardState =
  | { status: "loading" }
  | { status: "ready"; uri: string }
  | { status: "error" };

/** Cards are 150 KB and up; anything this small is an error body, not a card. */
const MIN_CARD_BYTES = 1024;

interface UseShareCardsOptions {
  festivalId: string;
  data: WrappedData;
  officialStats: WrappedOfficialStats | null;
  lang: ShareLang;
  /** Downloads start once this is true; the story turns it on at the Prost slide. */
  enabled?: boolean;
}

/**
 * Downloads every offered card into the cache once enabled, so they are
 * usually ready by the time the carousel opens.
 */
export function useShareCards({
  festivalId,
  data,
  officialStats,
  lang,
  enabled = true,
}: UseShareCardsOptions) {
  const apiClient = useApiClient();
  const cards = useMemo(
    () => buildShareCards(data, officialStats),
    [data, officialStats],
  );
  const [states, setStates] = useState<
    Partial<Record<ShareCardKind, ShareCardState>>
  >({});
  // Only a card's latest download may land; an older one finishing late is dropped
  const [beginRequest] = useState(createLatestRequestGate<ShareCardKind>);

  const load = useCallback(
    async (card: ShareCard) => {
      const isStale = beginRequest(card.kind);
      setStates((previous) => ({
        ...previous,
        [card.kind]: { status: "loading" },
      }));
      const fingerprint = shareCardFingerprint(card);
      const file = new File(
        Paths.cache,
        `wrapped-${festivalId}-${card.kind}-${lang}-${fingerprint}.jpg`,
      );
      try {
        if (!file.exists || (file.size ?? 0) < MIN_CARD_BYTES) {
          const { url, headers } = await apiClient.wrapped.shareCardRequest(
            festivalId,
            card.kind,
            lang,
            fingerprint,
          );
          await File.downloadFileAsync(url, file, {
            headers,
            idempotent: true,
          });
        }
        if ((file.size ?? 0) < MIN_CARD_BYTES) {
          file.delete();
          throw new Error(`Share card ${card.kind} came back empty`);
        }
        if (isStale()) {
          return;
        }
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "ready", uri: file.uri },
        }));
      } catch (error) {
        logger.warn("Share card download failed", {
          kind: card.kind,
          error: error instanceof Error ? error.message : String(error),
        });
        if (isStale()) {
          return;
        }
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "error" },
        }));
      }
    },
    [apiClient, beginRequest, festivalId, lang],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    for (const card of cards) {
      void load(card);
    }
  }, [cards, enabled, load]);

  const retry = useCallback(
    (kind: ShareCardKind) => {
      const card = cards.find((candidate) => candidate.kind === kind);
      if (card) {
        void load(card);
      }
    },
    [cards, load],
  );

  return { cards, states, retry };
}
