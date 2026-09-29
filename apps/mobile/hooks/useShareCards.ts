import type { ShareLang } from "@prostcounter/shared";
import { useApiClient } from "@prostcounter/shared/data";
import {
  buildShareCards,
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
}

/**
 * Downloads every offered card into the cache as soon as it mounts (the Prost
 * slide), so they are usually ready by the time the carousel opens.
 */
export function useShareCards({
  festivalId,
  data,
  officialStats,
  lang,
}: UseShareCardsOptions) {
  const apiClient = useApiClient();
  const cards = useMemo(
    () => buildShareCards(data, officialStats),
    [data, officialStats],
  );
  const [states, setStates] = useState<
    Partial<Record<ShareCardKind, ShareCardState>>
  >({});

  const load = useCallback(
    async (card: ShareCard) => {
      setStates((previous) => ({
        ...previous,
        [card.kind]: { status: "loading" },
      }));
      const file = new File(
        Paths.cache,
        `wrapped-${festivalId}-${card.kind}-${lang}-${shareCardFingerprint(card)}.jpg`,
      );
      try {
        if (!file.exists || (file.size ?? 0) < MIN_CARD_BYTES) {
          const { url, headers } = await apiClient.wrapped.shareCardRequest(
            festivalId,
            card.kind,
            lang,
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
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "ready", uri: file.uri },
        }));
      } catch (error) {
        logger.warn("Share card download failed", {
          kind: card.kind,
          error: error instanceof Error ? error.message : String(error),
        });
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "error" },
        }));
      }
    },
    [apiClient, festivalId, lang],
  );

  useEffect(() => {
    for (const card of cards) {
      void load(card);
    }
  }, [cards, load]);

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
