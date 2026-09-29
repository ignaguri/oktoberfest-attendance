"use client";

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
  /** Downloads start once this is true; the story turns it on at the Prost slide. */
  enabled?: boolean;
}

/** Fetches every offered card as a blob once enabled; a replaced or unmounted card's URL is revoked. */
export function useWebShareCards({
  festivalId,
  data,
  officialStats,
  lang,
  enabled = true,
}: Options) {
  const apiClient = useApiClient();
  const cards = useMemo(
    () => buildShareCards(data, officialStats),
    [data, officialStats],
  );
  const [states, setStates] = useState<
    Partial<Record<ShareCardKind, WebShareCardState>>
  >({});
  const objectUrls = useRef<Partial<Record<ShareCardKind, string>>>({});
  // A download landing after unmount would create a URL nothing ever revokes
  const unmounted = useRef(false);
  // Only a card's latest download may land; an older one finishing late is dropped
  const [beginRequest] = useState(createLatestRequestGate<ShareCardKind>);

  const load = useCallback(
    async (card: ShareCard) => {
      const isStale = beginRequest(card.kind);
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
        if (isStale() || unmounted.current) {
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const replaced = objectUrls.current[card.kind];
        if (replaced) {
          URL.revokeObjectURL(replaced);
        }
        objectUrls.current[card.kind] = objectUrl;
        setStates((previous) => ({
          ...previous,
          [card.kind]: { status: "ready", url: objectUrl, blob },
        }));
      } catch {
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

  useEffect(() => {
    // Strict Mode runs this cleanup once before the real mount
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      for (const objectUrl of Object.values(objectUrls.current)) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

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
