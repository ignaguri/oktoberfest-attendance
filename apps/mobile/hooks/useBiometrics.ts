import {
  isBiometricEnabled,
  setBiometricEnabled as storeBiometricEnabled,
  clearBiometricEnabled,
} from "@/lib/auth/secure-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useState, useEffect } from "react";

export type BiometricType = "facial" | "fingerprint" | null;

interface UseBiometricsResult {
  /** Whether biometric hardware is available on this device */
  isAvailable: boolean;
  /** Type of biometric available (facial recognition or fingerprint) */
  biometricType: BiometricType;
  /** Whether biometric authentication is enabled for this user */
  isEnabled: boolean;
  /** Whether the biometric check is still loading */
  isLoading: boolean;
  /** Authenticate using biometrics */
  authenticate: () => Promise<{ success: boolean; error?: string }>;
  /** Enable biometric authentication */
  enableBiometrics: () => Promise<void>;
  /** Disable biometric authentication */
  disableBiometrics: () => Promise<void>;
  /** Refresh the biometric state */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing biometric authentication (Face ID / Touch ID)
 *
 * Provides biometric availability check, authentication, and enable/disable functionality.
 */
export function useBiometrics(): UseBiometricsResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load biometric availability and enabled state
   */
  async function loadBiometricState() {
    setIsLoading(true);

    try {
      // Check hardware and enrollment in parallel with enabled state
      const [hardwareResult, enabledResult] = await Promise.all([
        checkHardwareAndEnrollment(),
        isBiometricEnabled(),
      ]);

      setIsAvailable(hardwareResult.available);
      setBiometricType(hardwareResult.type);
      setIsEnabled(enabledResult);
    } catch (error) {
      console.error("Error loading biometric state:", error);
      setIsAvailable(false);
      setBiometricType(null);
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Initialize on mount
  useEffect(() => {
    loadBiometricState();
  }, []);

  /**
   * Authenticate using biometrics
   */
  async function authenticate(): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Check current availability (avoid stale closure)
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return {
        success: false,
        error: "Biometric authentication not available",
      };
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to ProstCounter",
        fallbackLabel: "Use password",
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      if (result.success) {
        return { success: true };
      }

      // Handle different error cases
      switch (result.error) {
        case "user_cancel":
          return { success: false, error: "Authentication cancelled" };
        case "user_fallback":
          return { success: false, error: "User chose password fallback" };
        case "lockout":
          return {
            success: false,
            error: "Too many failed attempts. Please try again later.",
          };
        default:
          return {
            success: false,
            error: result.error || "Authentication failed",
          };
      }
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Enable biometric authentication
   */
  async function enableBiometrics() {
    await storeBiometricEnabled(true);
    setIsEnabled(true);
  }

  /**
   * Disable biometric authentication
   */
  async function disableBiometrics() {
    await clearBiometricEnabled();
    setIsEnabled(false);
  }

  return {
    isAvailable,
    biometricType,
    isEnabled,
    isLoading,
    authenticate,
    enableBiometrics,
    disableBiometrics,
    refresh: loadBiometricState,
  };
}

/**
 * Check biometric hardware availability and enrollment
 */
async function checkHardwareAndEnrollment(): Promise<{
  available: boolean;
  type: BiometricType;
}> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) {
    return { available: false, type: null };
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return { available: false, type: null };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  let type: BiometricType = null;
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    type = "facial";
  } else if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    type = "fingerprint";
  }

  return { available: true, type };
}
