import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  isBiometricEnabled,
  setBiometricEnabled as storeBiometricEnabled,
  clearBiometricEnabled,
} from '@/lib/auth/secure-storage';

export type BiometricType = 'facial' | 'fingerprint' | null;

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
   * Check biometric hardware availability and type
   */
  const checkBiometricAvailability = useCallback(async () => {
    try {
      // Check if hardware supports biometrics
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        setIsAvailable(false);
        setBiometricType(null);
        return;
      }

      // Check if biometrics are enrolled
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        setIsAvailable(false);
        setBiometricType(null);
        return;
      }

      setIsAvailable(true);

      // Get supported authentication types
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ) {
        setBiometricType('facial');
      } else if (
        types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ) {
        setBiometricType('fingerprint');
      } else {
        setBiometricType(null);
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setIsAvailable(false);
      setBiometricType(null);
    }
  }, []);

  /**
   * Check if biometric authentication is enabled in storage
   */
  const checkBiometricEnabled = useCallback(async () => {
    try {
      const enabled = await isBiometricEnabled();
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error checking biometric enabled state:', error);
      setIsEnabled(false);
    }
  }, []);

  /**
   * Initialize biometric state
   */
  const initialize = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([checkBiometricAvailability(), checkBiometricEnabled()]);
    setIsLoading(false);
  }, [checkBiometricAvailability, checkBiometricEnabled]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Authenticate using biometrics
   */
  const authenticate = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!isAvailable) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to ProstCounter',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        return { success: true };
      }

      // Handle different error cases
      if (result.error === 'user_cancel') {
        return { success: false, error: 'Authentication cancelled' };
      } else if (result.error === 'user_fallback') {
        return { success: false, error: 'User chose password fallback' };
      } else if (result.error === 'lockout') {
        return {
          success: false,
          error: 'Too many failed attempts. Please try again later.',
        };
      }

      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }, [isAvailable]);

  /**
   * Enable biometric authentication
   */
  const enableBiometrics = useCallback(async () => {
    await storeBiometricEnabled(true);
    setIsEnabled(true);
  }, []);

  /**
   * Disable biometric authentication
   */
  const disableBiometrics = useCallback(async () => {
    await clearBiometricEnabled();
    setIsEnabled(false);
  }, []);

  /**
   * Refresh the biometric state
   */
  const refresh = useCallback(async () => {
    await initialize();
  }, [initialize]);

  return {
    isAvailable,
    biometricType,
    isEnabled,
    isLoading,
    authenticate,
    enableBiometrics,
    disableBiometrics,
    refresh,
  };
}
