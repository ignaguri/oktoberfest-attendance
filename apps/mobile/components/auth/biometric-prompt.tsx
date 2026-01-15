import React from "react";
import { View, ActivityIndicator } from "react-native";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTranslation } from "react-i18next";
import { Fingerprint, ScanFace } from "lucide-react-native";

interface BiometricPromptProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when biometric auth is initiated */
  onAuthenticate: () => void;
  /** Callback when user chooses to use password instead */
  onUsePassword: () => void;
  /** Type of biometric available */
  biometricType: "facial" | "fingerprint" | null;
  /** Whether authentication is in progress */
  isAuthenticating?: boolean;
}

/**
 * Biometric Prompt Component
 *
 * Modal prompting the user to authenticate with Face ID or Touch ID.
 * Provides a fallback option to use password instead.
 */
export function BiometricPrompt({
  isOpen,
  onClose,
  onAuthenticate,
  onUsePassword,
  biometricType,
  isAuthenticating = false,
}: BiometricPromptProps) {
  const { t } = useTranslation();

  const BiometricIcon = biometricType === "facial" ? ScanFace : Fingerprint;
  const biometricName =
    biometricType === "facial"
      ? t("auth.biometric.faceId", { defaultValue: "Face ID" })
      : t("auth.biometric.touchId", { defaultValue: "Touch ID" });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalBackdrop />
      <ModalContent className="items-center">
        <ModalBody className="items-center pt-6">
          {isAuthenticating ? (
            <ActivityIndicator size="large" color="#F59E0B" className="my-4" />
          ) : (
            <View className="mb-4 rounded-full bg-primary-100 p-4">
              <BiometricIcon size={48} className="text-primary-600" />
            </View>
          )}

          <Text className="text-center text-xl font-semibold text-typography-900">
            {t("auth.biometric.prompt", {
              defaultValue: `Sign in with ${biometricName}`,
              biometricName,
            })}
          </Text>

          <Text className="mt-2 text-center text-typography-500">
            {t("auth.biometric.description", {
              defaultValue: `Use ${biometricName} for quick and secure access to your account`,
              biometricName,
            })}
          </Text>
        </ModalBody>

        <ModalFooter className="w-full flex-col gap-3 pb-6">
          <Button
            action="primary"
            variant="solid"
            size="lg"
            onPress={onAuthenticate}
            disabled={isAuthenticating}
            className="w-full rounded-full"
          >
            <ButtonText>
              {isAuthenticating
                ? t("common.status.authenticating", {
                    defaultValue: "Authenticating...",
                  })
                : t("auth.biometric.authenticate", {
                    defaultValue: `Use ${biometricName}`,
                    biometricName,
                  })}
            </ButtonText>
          </Button>

          <Button
            action="secondary"
            variant="ghost"
            size="lg"
            onPress={onUsePassword}
            disabled={isAuthenticating}
            className="w-full"
          >
            <ButtonText>
              {t("auth.biometric.usePassword", {
                defaultValue: "Use password instead",
              })}
            </ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

interface BiometricEnablePromptProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user enables biometric auth */
  onEnable: () => void;
  /** Callback when user skips biometric setup */
  onSkip: () => void;
  /** Type of biometric available */
  biometricType: "facial" | "fingerprint" | null;
}

/**
 * Biometric Enable Prompt Component
 *
 * Modal asking the user if they want to enable biometric authentication
 * after a successful sign-in.
 */
export function BiometricEnablePrompt({
  isOpen,
  onClose,
  onEnable,
  onSkip,
  biometricType,
}: BiometricEnablePromptProps) {
  const { t } = useTranslation();

  const BiometricIcon = biometricType === "facial" ? ScanFace : Fingerprint;
  const biometricName =
    biometricType === "facial"
      ? t("auth.biometric.faceId", { defaultValue: "Face ID" })
      : t("auth.biometric.touchId", { defaultValue: "Touch ID" });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalBackdrop />
      <ModalContent className="items-center">
        <ModalBody className="items-center pt-6">
          <View className="mb-4 rounded-full bg-primary-100 p-4">
            <BiometricIcon size={48} className="text-primary-600" />
          </View>

          <Text className="text-center text-xl font-semibold text-typography-900">
            {t("auth.biometric.enableTitle", {
              defaultValue: `Enable ${biometricName}?`,
              biometricName,
            })}
          </Text>

          <Text className="mt-2 text-center text-typography-500">
            {t("auth.biometric.enableDescription", {
              defaultValue: `Use ${biometricName} for faster sign-in next time`,
              biometricName,
            })}
          </Text>
        </ModalBody>

        <ModalFooter className="w-full flex-col gap-3 pb-6">
          <Button
            action="primary"
            variant="solid"
            size="lg"
            onPress={onEnable}
            className="w-full rounded-full"
          >
            <ButtonText>
              {t("auth.biometric.enableButton", { defaultValue: "Enable" })}
            </ButtonText>
          </Button>

          <Button
            action="secondary"
            variant="ghost"
            size="lg"
            onPress={onSkip}
            className="w-full"
          >
            <ButtonText>
              {t("auth.biometric.skipButton", { defaultValue: "Not now" })}
            </ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
