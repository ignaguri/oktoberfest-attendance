import {
  buildShareCards,
  isLinkableShareCardKind,
  type LinkableShareCardKind,
  type ShareCard,
  type ShareCardKind,
  type WrappedOfficialStats,
} from "@prostcounter/shared/wrapped/server";

import { logger } from "../lib/logger";
import { NotFoundError, ValidationError } from "../middleware/error";
import type {
  IWrappedRepository,
  WrappedShareRecord,
  WrappedShareStore,
} from "../repositories/interfaces";
import type { OfficialStatsReader } from "./wrapped.service";

/**
 * Share cards and their public links. Reads the Wrapped without recording a
 * view (that is GET /wrapped/{festivalId}'s job).
 */
export class WrappedShareService {
  constructor(
    private wrappedRepo: IWrappedRepository,
    private officialStatsRepo: OfficialStatsReader,
    private store: WrappedShareStore,
  ) {}

  async getCards(userId: string, festivalId: string): Promise<ShareCard[]> {
    const status = await this.wrappedRepo.getStatus(festivalId);
    if (!status || !status.hasAttendance || !status.isUnlocked) {
      throw new NotFoundError("Wrapped not available");
    }
    const data = await this.wrappedRepo.getWrapped(userId, festivalId);
    return buildShareCards(data, await this.readOfficialStats(festivalId));
  }

  async getCard(
    userId: string,
    festivalId: string,
    kind: ShareCardKind,
  ): Promise<ShareCard> {
    const card = (await this.getCards(userId, festivalId)).find(
      (candidate) => candidate.kind === kind,
    );
    if (!card) {
      throw new NotFoundError("This Wrapped has no such card");
    }
    return card;
  }

  async listLinks(
    userId: string,
    festivalId: string,
  ): Promise<WrappedShareRecord[]> {
    return this.store.listLive(userId, festivalId);
  }

  async createLink(
    userId: string,
    festivalId: string,
    kind: LinkableShareCardKind,
  ): Promise<string> {
    if (!isLinkableShareCardKind(kind)) {
      throw new ValidationError("This card can't be shared by link");
    }
    const card = await this.getCard(userId, festivalId, kind);
    return this.store.upsertLive(userId, festivalId, kind, card);
  }

  async revokeLink(userId: string, token: string): Promise<void> {
    if (!(await this.store.revoke(userId, token))) {
      throw new NotFoundError("Share link not found");
    }
  }

  private async readOfficialStats(
    festivalId: string,
  ): Promise<WrappedOfficialStats | null> {
    try {
      return await this.officialStatsRepo.getForWrapped(festivalId);
    } catch (error) {
      logger.error(
        {
          festivalId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Official stats read failed; share cards without them",
      );
      return null;
    }
  }
}
