import type { LinkableShareCardKind, ShareCard } from "@prostcounter/shared/wrapped";

export interface WrappedShareRecord {
  token: string;
  kind: LinkableShareCardKind;
}

export interface PublicWrappedShare {
  kind: LinkableShareCardKind;
  card: ShareCard;
  festivalName: string;
}

/** Public share links for Wrapped cards (wrapped_shares). */
export interface WrappedShareStore {
  /** The caller's live links for one festival. */
  listLive(userId: string, festivalId: string): Promise<WrappedShareRecord[]>;
  /** Reuse the live link for this card (refreshing its snapshot) or create one. Returns the token. */
  upsertLive(
    userId: string,
    festivalId: string,
    kind: LinkableShareCardKind,
    card: ShareCard,
  ): Promise<string>;
  /** False when the token is not the caller's or is already revoked. */
  revoke(userId: string, token: string): Promise<boolean>;
  /** A live link's snapshot, readable without auth; null when unknown or revoked. */
  getPublic(token: string): Promise<PublicWrappedShare | null>;
}
