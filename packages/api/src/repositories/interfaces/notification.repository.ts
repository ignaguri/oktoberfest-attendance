import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from "@prostcounter/shared";

/**
 * Notification repository interface
 * Provides data access for FCM tokens and notification preferences
 */
export interface INotificationRepository {
  /**
   * Register or update FCM token for a user
   * @param userId - User ID
   * @param token - FCM device token
   */
  registerFCMToken(userId: string, token: string): Promise<void>;

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
    preferences: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferences>;

  /**
   * Get user's FCM tokens
   * @param userId - User ID
   * @returns Array of active FCM tokens
   */
  getFCMTokens(userId: string): Promise<string[]>;

  /**
   * Remove FCM token
   * @param userId - User ID
   * @param token - FCM device token to remove
   */
  removeFCMToken(userId: string, token: string): Promise<void>;

  /**
   * Check if user can receive notification (rate limiting)
   * @param userId - User ID
   * @param notificationType - Type of notification
   * @returns True if notification can be sent
   */
  canSendNotification(
    userId: string,
    notificationType: string
  ): Promise<boolean>;

  /**
   * Record that a notification was sent
   * @param userId - User ID
   * @param notificationType - Type of notification
   */
  recordNotificationSent(
    userId: string,
    notificationType: string
  ): Promise<void>;
}
