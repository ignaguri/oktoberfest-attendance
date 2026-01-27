import { Fingerprint, ScanFace } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";

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
      ? t("auth.biometric.faceId")
      : t("auth.biometric.touchId");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalBackdrop />
      <ModalContent>
        <ModalBody className="pt-6">
          <View className="items-center">
            {isAuthenticating ? (
              <ActivityIndicator
                size="large"
                color="#F59E0B"
                className="my-4"
              />
            ) : (
              <View className="bg-primary-100 mb-4 rounded-full p-4">
                <BiometricIcon size={48} className="text-primary-600" />
              </View>
            )}

            <Text className="text-typography-900 text-center text-xl font-semibold">
              {t("auth.biometric.prompt", {
                biometricName,
              })}
            </Text>

            <Text className="text-typography-500 mt-2 text-center">
              {t("auth.biometric.description", {
                biometricName,
              })}
            </Text>
          </View>
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
                ? t("common.status.authenticating")
                : t("auth.biometric.authenticate", {
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
            <ButtonText>{t("auth.biometric.usePassword")}</ButtonText>
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
      ? t("auth.biometric.faceId")
      : t("auth.biometric.touchId");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalBackdrop />
      <ModalContent>
        <ModalBody className="pt-6">
          <View className="items-center">
            <View className="bg-primary-100 mb-4 rounded-full p-4">
              <BiometricIcon size={48} className="text-primary-600" />
            </View>

            <Text className="text-typography-900 text-center text-xl font-semibold">
              {t("auth.biometric.enableTitle", {
                biometricName,
              })}
            </Text>

            <Text className="text-typography-500 mt-2 text-center">
              {t("auth.biometric.enableDescription", {
                biometricName,
              })}
            </Text>
          </View>
        </ModalBody>

        <ModalFooter className="w-full flex-col gap-3 pb-6">
          <Button
            action="primary"
            variant="solid"
            size="lg"
            onPress={onEnable}
            className="w-full rounded-full"
          >
            <ButtonText>{t("auth.biometric.enableButton")}</ButtonText>
          </Button>

          <Button
            action="secondary"
            variant="ghost"
            size="lg"
            onPress={onSkip}
            className="w-full"
          >
            <ButtonText>{t("auth.biometric.skipButton")}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
