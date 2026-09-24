import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from "@prostcounter/shared";

/**
 * Notification repository interface
 * Provides data access for notification preferences
 */
export interface INotificationRepository {
  /**
   * Get user's notification preferences
   * @param userId - User ID
   * @returns Notification preferences
   */
  getPreferences(userId: string): Promise<NotificationPreferences | null>;

  /**
   * Update user's notification preferences
   * @param userId - User ID
   * @param preferences - Updated preferences
   * @returns Updated preferences
   */
  updatePreferences(
    userId: string,
    preferences: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences>;

  /**
   * Check if user can receive notification (rate limiting)
   * @param userId - User ID
   * @param notificationType - Type of notification
   * @returns True if notification can be sent
   */
  canSendNotification(userId: string, notificationType: string): Promise<boolean>;

  /**
   * Record that a notification was sent
   * @param userId - User ID
   * @param notificationType - Type of notification
   */
  recordNotificationSent(userId: string, notificationType: string): Promise<void>;
}
