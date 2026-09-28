import type {
  GetWrappedResponse,
  WrappedAccessResult,
  WrappedFestival,
} from "@prostcounter/shared";

import type { IWrappedRepository } from "../repositories/interfaces";

/**
 * Wrapped year-in-review. SQL decides when a festival unlocks; this turns the
 * caller's status into one of three responses and records the view.
 */
export class WrappedService {
  constructor(private wrappedRepo: IWrappedRepository) {}

  async getWrapped(userId: string, festivalId: string): Promise<GetWrappedResponse> {
    const status = await this.wrappedRepo.getStatus(festivalId);

    if (!status || !status.hasAttendance) {
      return { status: "not_attended" };
    }

    if (!status.isUnlocked) {
      return { status: "locked", unlocksAt: status.unlocksAt };
    }

    const wrapped = await this.wrappedRepo.getWrapped(userId, festivalId);
    // Returning it here is the user seeing it
    await this.wrappedRepo.markViewed(userId, festivalId);

    return { status: "ready", wrapped };
  }

  async listFestivals(): Promise<WrappedFestival[]> {
    return this.wrappedRepo.listFestivals();
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
}
