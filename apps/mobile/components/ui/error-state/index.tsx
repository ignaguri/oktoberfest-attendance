import { useTranslation } from "@prostcounter/shared/i18n";
import { AlertCircle, RefreshCw } from "lucide-react-native";
import React from "react";

import { Alert, AlertText } from "@/components/ui/alert";
import { Button, ButtonText } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface ErrorStateProps {
  /** The error to display */
  error?: Error | null;
  /** Custom error message (overrides error.message) */
  message?: string;
  /** Custom title for the error */
  title?: string;
  /** Callback when retry button is pressed */
  onRetry?: () => void;
  /** Whether to show the retry button */
  showRetry?: boolean;
}

/**
 * Reusable error state component for displaying errors with optional retry.
 * Use this when a data fetch or operation fails.
 */
export function ErrorState({
  error,
  message,
  title,
  onRetry,
  showRetry = true,
}: ErrorStateProps) {
  const { t } = useTranslation();

  const errorMessage =
    message || error?.message || t("common.errors.unexpected");

  const errorTitle = title || t("common.errors.title");

  return (
    <VStack space="md" className="items-center p-4">
      <Alert action="error" variant="outline" className="w-full">
        <AlertCircle size={20} color={IconColors.error} />
        <VStack space="xs" className="flex-1">
          <AlertText bold>{errorTitle}</AlertText>
          <AlertText size="sm">{errorMessage}</AlertText>
        </VStack>
      </Alert>
      {showRetry && onRetry && (
        <Button variant="outline" action="secondary" onPress={onRetry}>
          <RefreshCw size={18} color={IconColors.default} />
          <ButtonText>{t("common.buttons.tryAgain")}</ButtonText>
        </Button>
      )}
    </VStack>
  );
}

ErrorState.displayName = "ErrorState";
