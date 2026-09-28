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

    return { result: { status: "ready", wrapped }, viewRecorded: !isPreview };
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
