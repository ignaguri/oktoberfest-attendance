import * as SecureStore from "expo-secure-store";

/**
 * Storage keys for auth data
 */
const KEYS = {
  ACCESS_TOKEN: "prostcounter_access_token",
  REFRESH_TOKEN: "prostcounter_refresh_token",
  BIOMETRIC_ENABLED: "prostcounter_biometric_enabled",
  USER_EMAIL: "prostcounter_user_email",
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
