import { Alert, AlertText } from "@/components/ui/alert";
import { Button, ButtonText } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "@prostcounter/shared/i18n";
import React from "react";

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
    message ||
    error?.message ||
    t("common.errors.unexpected", {
      defaultValue: "An unexpected error occurred",
    });

  const errorTitle =
    title ||
    t("common.errors.title", {
      defaultValue: "Something went wrong",
    });

  return (
    <VStack space="md" className="items-center p-4">
      <Alert action="error" variant="outline" className="w-full">
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={20}
          color="#DC2626"
        />
        <VStack space="xs" className="flex-1">
          <AlertText bold>{errorTitle}</AlertText>
          <AlertText size="sm">{errorMessage}</AlertText>
        </VStack>
      </Alert>
      {showRetry && onRetry && (
        <Button variant="outline" action="secondary" onPress={onRetry}>
          <MaterialCommunityIcons name="refresh" size={18} color="#6B7280" />
          <ButtonText>
            {t("common.buttons.tryAgain", { defaultValue: "Try Again" })}
          </ButtonText>
        </Button>
      )}
    </VStack>
  );
}

ErrorState.displayName = "ErrorState";
