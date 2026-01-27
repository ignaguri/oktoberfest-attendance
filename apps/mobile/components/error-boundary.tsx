import { useTranslation } from "@prostcounter/shared/i18n";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the entire app.
 */
class ErrorBoundaryClass extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console (Sentry integration can be added later)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

/**
 * Default fallback UI displayed when an error is caught.
 * Uses hooks so must be a functional component.
 */
function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-background-50 p-6">
      <VStack space="lg" className="items-center">
        <Heading size="xl" className="text-error-600">
          {t("common.errors.title")}
        </Heading>
        <Text className="text-center text-typography-500">
          {t("common.errors.unexpected")}
        </Text>
        {__DEV__ && error && (
          <View className="rounded-md bg-background-100 p-3">
            <Text className="font-mono text-xs text-error-500">
              {error.message}
            </Text>
          </View>
        )}
        <Button action="primary" onPress={onReset}>
          <ButtonText>{t("common.buttons.tryAgain")}</ButtonText>
        </Button>
      </VStack>
    </View>
  );
}

export { ErrorBoundaryClass as ErrorBoundary };
