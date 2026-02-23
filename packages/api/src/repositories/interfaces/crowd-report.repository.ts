import type {
  CrowdLevel,
  CrowdReportWithUser,
  SubmitCrowdReportBody,
  TentCrowdStatus,
} from "@prostcounter/shared";

/**
 * Crowd report repository interface
 * Provides data access for tent crowd reports
 */
export interface ICrowdReportRepository {
  /**
   * Get aggregated crowd status for all tents in a festival
   * @param festivalId - Festival ID
   * @returns Array of tent crowd statuses
   */
  getCrowdStatus(festivalId: string): Promise<TentCrowdStatus[]>;

  /**
   * Get recent crowd reports for a specific tent
   * Reports from last 30 minutes, ordered by most recent first
   * @param tentId - Tent ID
   * @param festivalId - Festival ID
   * @returns Array of crowd reports with user info
   */
  getTentReports(
    tentId: string,
    festivalId: string,
  ): Promise<CrowdReportWithUser[]>;

  /**
   * Submit a new crowd report
   * @param tentId - Tent ID
   * @param userId - User ID
   * @param data - Report data (festivalId, crowdLevel, waitTimeMinutes)
   * @returns The created report
   */
  submitReport(
    tentId: string,
    userId: string,
    data: SubmitCrowdReportBody,
  ): Promise<{
    id: string;
    crowdLevel: CrowdLevel;
    waitTimeMinutes: number | null;
    createdAt: string;
  }>;

  /**
   * Check if user has a recent report for a tent (within last 5 minutes)
   * Used for rate limiting
   * @param tentId - Tent ID
   * @param userId - User ID
   * @returns true if a recent report exists
   */
  hasRecentReport(tentId: string, userId: string): Promise<boolean>;
}
