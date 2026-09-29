import type { Database, Json } from "@prostcounter/db";
import {
  isLinkableShareCardKind,
  type LinkableShareCardKind,
  type ShareCard,
} from "@prostcounter/shared/wrapped/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type {
  PublicWrappedShare,
  WrappedShareRecord,
  WrappedShareStore,
} from "../interfaces";

const UNIQUE_VIOLATION = "23505";

export class SupabaseWrappedShareRepository implements WrappedShareStore {
  /**
   * `supabase` reads (and revokes) as the caller, under RLS. Snapshots are
   * published under the ProstCounter name, so users cannot write them: only
   * `writer` (the API's service-role client) can, after the service built the
   * card from the caller's own Wrapped.
   */
  constructor(
    private supabase: SupabaseClient<Database>,
    private writer?: SupabaseClient<Database>,
  ) {}

  private requireWriter(): SupabaseClient<Database> {
    if (!this.writer) {
      throw new DatabaseError("Share links need a service-role writer");
    }
    return this.writer;
  }

  async listLive(
    userId: string,
    festivalId: string,
  ): Promise<WrappedShareRecord[]> {
    const { data, error } = await this.supabase
      .from("wrapped_shares")
      .select("token, card_kind")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .is("revoked_at", null);
    if (error) {
      throw new DatabaseError(`Failed to list share links: ${error.message}`);
    }
    return (data ?? []).flatMap((row) =>
      isLinkableShareCardKind(row.card_kind)
        ? [{ token: row.token, kind: row.card_kind }]
        : [],
    );
  }

  async upsertLive(
    userId: string,
    festivalId: string,
    kind: LinkableShareCardKind,
    card: ShareCard,
  ): Promise<string> {
    const writer = this.requireWriter();
    const cardData = card as unknown as Json;
    const existing = await this.findLiveToken(userId, festivalId, kind);
    if (existing) {
      const { error } = await writer
        .from("wrapped_shares")
        .update({ card_data: cardData })
        .eq("token", existing)
        .eq("user_id", userId);
      if (error) {
        throw new DatabaseError(
          `Failed to refresh share link: ${error.message}`,
        );
      }
      return existing;
    }

    const { data, error } = await writer
      .from("wrapped_shares")
      .insert({
        user_id: userId,
        festival_id: festivalId,
        card_kind: kind,
        card_data: cardData,
      })
      .select("token")
      .single();
    if (error?.code === UNIQUE_VIOLATION) {
      // Another tap won the race; its link is the live one
      const raced = await this.findLiveToken(userId, festivalId, kind);
      if (raced) {
        return raced;
      }
    }
    if (error || !data) {
      throw new DatabaseError(`Failed to create share link: ${error?.message}`);
    }
    return data.token;
  }

  async revoke(userId: string, token: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("wrapped_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", token)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id");
    if (error) {
      throw new DatabaseError(`Failed to revoke share link: ${error.message}`);
    }
    return (data?.length ?? 0) > 0;
  }

  async getPublic(token: string): Promise<PublicWrappedShare | null> {
    const { data, error } = await this.supabase.rpc("get_wrapped_share", {
      p_token: token,
    });
    if (error) {
      throw new DatabaseError(`Failed to read share link: ${error.message}`);
    }
    const row = data?.[0];
    const card = row?.card_data as unknown as ShareCard | undefined;
    // A snapshot must be the card its row says it is, and never photos
    if (
      !row ||
      !card ||
      !isLinkableShareCardKind(row.card_kind) ||
      card.kind !== row.card_kind
    ) {
      return null;
    }
    return {
      kind: row.card_kind,
      card,
      festivalName: row.festival_name,
    };
  }

  private async findLiveToken(
    userId: string,
    festivalId: string,
    kind: LinkableShareCardKind,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("wrapped_shares")
      .select("token")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("card_kind", kind)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) {
      throw new DatabaseError(`Failed to read share link: ${error.message}`);
    }
    return data?.token ?? null;
  }
}
