import * as SecureStore from "expo-secure-store";

/**
 * Storage keys for auth data
 */
const KEYS = {
  ACCESS_TOKEN: "prostcounter_access_token",
  REFRESH_TOKEN: "prostcounter_refresh_token",
  BIOMETRIC_ENABLED: "prostcounter_biometric_enabled",
  USER_EMAIL: "prostcounter_user_email",
  // Notification keys
  NOTIFICATION_PROMPT_SHOWN: "prostcounter_notification_prompt_shown",
  NOTIFICATION_PERMISSION_STATUS: "prostcounter_notification_permission_status",
  FCM_TOKEN: "prostcounter_fcm_token",
  // Location keys
  LOCATION_PROMPT_SHOWN: "prostcounter_location_prompt_shown",
  LOCATION_PERMISSION_STATUS: "prostcounter_location_permission_status",
  LOCATION_SESSION_ID: "prostcounter_location_session_id",
} as const;

/**
 * Store session tokens securely
 */
export async function storeSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
  ]);
}

/**
 * Retrieve stored session tokens
 */
export async function getStoredSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Clear stored session tokens
 */
export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
  ]);
}

/**
 * Store biometric preference
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.BIOMETRIC_ENABLED,
    enabled ? "true" : "false",
  );
}

/**
 * Get biometric preference
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED);
  return value === "true";
}

/**
 * Clear biometric preference
 */
export async function clearBiometricEnabled(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ENABLED);
}

/**
 * Store user email for biometric authentication
 */
export async function storeUserEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USER_EMAIL, email);
}

/**
 * Get stored user email
 */
export async function getStoredUserEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.USER_EMAIL);
}

/**
 * Clear stored user email
 */
export async function clearUserEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.USER_EMAIL);
}

/**
 * Clear all auth-related stored data
 */
export async function clearAllAuthData(): Promise<void> {
  await Promise.all([
    clearSession(),
    clearBiometricEnabled(),
    clearUserEmail(),
  ]);
}

// =============================================================================
// Notification Storage
// =============================================================================

/**
 * Store whether notification permission prompt has been shown
 */
export async function setNotificationPromptShown(
  shown: boolean,
): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.NOTIFICATION_PROMPT_SHOWN,
    shown ? "true" : "false",
  );
}

/**
 * Check if notification permission prompt has been shown
 */
export async function hasNotificationPromptBeenShown(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.NOTIFICATION_PROMPT_SHOWN);
  return value === "true";
}

/**
 * Store notification permission status
 */
export type NotificationPermissionStatus =
  | "undetermined"
  | "granted"
  | "denied";

export async function setNotificationPermissionStatus(
  status: NotificationPermissionStatus,
): Promise<void> {
  await SecureStore.setItemAsync(KEYS.NOTIFICATION_PERMISSION_STATUS, status);
}

/**
 * Get stored notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus | null> {
  const value = await SecureStore.getItemAsync(
    KEYS.NOTIFICATION_PERMISSION_STATUS,
  );
  if (value === "undetermined" || value === "granted" || value === "denied") {
    return value;
  }
  return null;
}

/**
 * Store FCM token
 */
export async function storeFCMToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.FCM_TOKEN, token);
}

/**
 * Get stored FCM token
 */
export async function getStoredFCMToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.FCM_TOKEN);
}

/**
 * Clear FCM token
 */
export async function clearFCMToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.FCM_TOKEN);
}

/**
 * Clear all notification-related stored data
 */
export async function clearAllNotificationData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.NOTIFICATION_PROMPT_SHOWN),
    SecureStore.deleteItemAsync(KEYS.NOTIFICATION_PERMISSION_STATUS),
    SecureStore.deleteItemAsync(KEYS.FCM_TOKEN),
  ]);
}

// =============================================================================
// Location Storage
// =============================================================================

/**
 * Store whether location permission prompt has been shown
 */
export async function setLocationPromptShown(shown: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.LOCATION_PROMPT_SHOWN,
    shown ? "true" : "false",
  );
}

/**
 * Check if location permission prompt has been shown
 */
export async function hasLocationPromptBeenShown(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.LOCATION_PROMPT_SHOWN);
  return value === "true";
}

/**
 * Store location permission status
 */
export type LocationPermissionStatus =
  | "undetermined"
  | "foreground"
  | "background"
  | "denied";

export async function setLocationPermissionStatus(
  status: LocationPermissionStatus,
): Promise<void> {
  await SecureStore.setItemAsync(KEYS.LOCATION_PERMISSION_STATUS, status);
}

/**
 * Get stored location permission status
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus | null> {
  const value = await SecureStore.getItemAsync(KEYS.LOCATION_PERMISSION_STATUS);
  if (
    value === "undetermined" ||
    value === "foreground" ||
    value === "background" ||
    value === "denied"
  ) {
    return value;
  }
  return null;
}

/**
 * Store active location session ID
 */
export async function storeLocationSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.LOCATION_SESSION_ID, sessionId);
}

/**
 * Get stored location session ID
 */
export async function getStoredLocationSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.LOCATION_SESSION_ID);
}

/**
 * Clear location session ID
 */
export async function clearLocationSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.LOCATION_SESSION_ID);
}

/**
 * Clear all location-related stored data
 */
export async function clearAllLocationData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.LOCATION_PROMPT_SHOWN),
    SecureStore.deleteItemAsync(KEYS.LOCATION_PERMISSION_STATUS),
    SecureStore.deleteItemAsync(KEYS.LOCATION_SESSION_ID),
  ]);
}
