"use client";

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WebShareCardState =
  | { status: "loading" }
  | { status: "ready"; url: string; blob: Blob }
  | { status: "error" };

interface Options {
  festivalId: string;
  data: WrappedData;
  officialStats: WrappedOfficialStats | null;
  lang: ShareLang;
}

/** Fetches every offered card as a blob on mount (the Prost slide); URLs are revoked on unmount. */
export function useWebShareCards({
  festivalId,
  data,
  officialStats,
  lang,
}: Options) {
  const apiClient = useApiClient();
  const cards = useMemo(
    () => buildShareCards(data, officialStats),
    [data, officialStats],
  );
  const [states, setStates] = useState<
    Partial<Record<ShareCardKind, WebShareCardState>>
  >({});
  const objectUrls = useRef<string[]>([]);

  const load = useCallback(
    async (card: ShareCard) => {
      setStates((previous) => ({
        ...previous,
        [card.kind]: { status: "loading" },
      }));
      try {
        const { url, headers } = await apiClient.wrapped.shareCardRequest(
          festivalId,
          card.kind,
          lang,
          shareCardFingerprint(card),
        );
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(
            `Share card ${card.kind} failed with ${response.status}`,
          );
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.current.push(objectUrl);
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "ready", url: objectUrl, blob },
        }));
      } catch {
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

  useEffect(
    () => () => {
      for (const objectUrl of objectUrls.current) {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [],
  );

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
