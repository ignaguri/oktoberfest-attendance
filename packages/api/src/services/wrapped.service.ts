import type {
  GetPersonaCollectionResponse,
  GetWrappedResponse,
  WrappedAccessResult,
  WrappedFestival,
  WrappedOfficialStats,
} from "@prostcounter/shared";
import { derivePersona, PERSONA_IDS, type PersonaId } from "@prostcounter/shared/wrapped/server";

import { logger } from "../lib/logger";
import type { IWrappedRepository } from "../repositories/interfaces";

/** The one official-stats method Wrapped needs (SupabaseOfficialStatsRepository). */
export interface OfficialStatsReader {
  getForWrapped(festivalId: string): Promise<WrappedOfficialStats | null>;
}

/**
 * Wrapped year-in-review. SQL decides when a festival unlocks; this turns the
 * caller's status into one of three responses and records the view.
 */
export class WrappedService {
  constructor(
    private wrappedRepo: IWrappedRepository,
    private officialStatsRepo: OfficialStatsReader,
  ) {}

  /**
   * viewRecorded is false for a super admin's preview of a locked festival:
   * that is not the user seeing their Wrapped, so it records nothing and the
   * route skips achievement evaluation.
   */
  async getWrapped(
    userId: string,
    festivalId: string,
  ): Promise<{ result: GetWrappedResponse; viewRecorded: boolean }> {
    const status = await this.wrappedRepo.getStatus(festivalId);

    if (!status || !status.hasAttendance) {
      return { result: { status: "not_attended" }, viewRecorded: false };
    }

    if (!status.isUnlocked) {
      return { result: { status: "locked", unlocksAt: status.unlocksAt }, viewRecorded: false };
    }

    const wrapped = await this.wrappedRepo.getWrapped(userId, festivalId);
    const isPreview = Date.now() < new Date(status.unlocksAt).getTime();
    if (!isPreview) {
      // Returning it here is the user seeing it
      await this.wrappedRepo.markViewed(userId, festivalId);
    }

    const officialStats = await this.readOfficialStats(festivalId);

    return { result: { status: "ready", wrapped, officialStats }, viewRecorded: !isPreview };
  }

  async listFestivals(): Promise<WrappedFestival[]> {
    return this.wrappedRepo.listFestivals();
  }

  /**
   * Personas earned across the user's unlocked Wrapped festivals. Reads the
   * cached Wrapped through the repository, never getWrapped above, so opening
   * the collection records no Wrapped view. A festival that fails to load is
   * skipped rather than failing the whole collection.
   */
  async getPersonaCollection(userId: string): Promise<GetPersonaCollectionResponse> {
    const festivals = await this.wrappedRepo.listFestivals();

    const derived = await Promise.all(
      festivals.map(async (festival) => {
        try {
          const data = await this.wrappedRepo.getWrapped(userId, festival.festivalId);
          return { festival, personaId: derivePersona(data).id };
        } catch (error) {
          logger.warn(
            { festivalId: festival.festivalId, error: error instanceof Error ? error.message : String(error) },
            "Persona collection skipped a festival whose Wrapped failed to load",
          );
          return null;
        }
      }),
    );

    // listFestivals is newest first, so each persona's festivals stay newest first
    const festivalsByPersona = new Map<PersonaId, { festivalId: string; name: string }[]>();
    for (const row of derived) {
      if (row === null) {
        continue;
      }
      const list = festivalsByPersona.get(row.personaId) ?? [];
      list.push({ festivalId: row.festival.festivalId, name: row.festival.name });
      festivalsByPersona.set(row.personaId, list);
    }

    const opened = new Set(await this.wrappedRepo.listOpenedPersonas(userId));

    return {
      earned: PERSONA_IDS.filter((personaId) => festivalsByPersona.has(personaId)).map((personaId) => ({
        personaId,
        festivals: festivalsByPersona.get(personaId) ?? [],
        opened: opened.has(personaId),
      })),
    };
  }

  async openPersonaCard(userId: string, personaId: PersonaId): Promise<void> {
    await this.wrappedRepo.markPersonaOpened(userId, personaId);
  }

  /**
   * @deprecated Shape of the old /access endpoint, kept for installed binaries.
   */
  async checkAccessLegacy(festivalId: string): Promise<WrappedAccessResult> {
    const status = await this.wrappedRepo.getStatus(festivalId);

    if (!status) {
      return { allowed: false, reason: "error" };
    }
    if (!status.isUnlocked) {
      return { allowed: false, reason: "not_ended" };
    }
    if (!status.hasAttendance) {
      return { allowed: false, reason: "no_data" };
    }

    return { allowed: true };
  }

  async regenerateCache(
    adminUserId: string,
    festivalId?: string,
    userId?: string,
  ): Promise<{ success: boolean; regeneratedCount: number }> {
    const regeneratedCount = await this.wrappedRepo.regenerateCache(adminUserId, festivalId, userId);

    return { success: true, regeneratedCount };
  }

  /** Missing stats only drop two slides, so a failed read never blocks the Wrapped. */
  private async readOfficialStats(festivalId: string): Promise<WrappedOfficialStats | null> {
    try {
      return await this.officialStatsRepo.getForWrapped(festivalId);
    } catch (error) {
      logger.error(
        { festivalId, error: error instanceof Error ? error.message : String(error) },
        "Official stats read failed; serving Wrapped without them",
      );
      return null;
    }
  }
}
