import { useTranslation } from "@prostcounter/shared/i18n";
import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";

interface SectionStateProps {
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Loading / error / empty handling shared by every analytics section, so an
 * empty range reads as "no data yet" instead of zeros.
 */
export function SectionState({ isLoading, error, isEmpty, onRetry, children }: SectionStateProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <Spinner />
      </View>
    );
  }
  if (error) {
    return <ErrorState message={t("admin.analytics.loadError")} onRetry={onRetry} />;
  }
  if (isEmpty) {
    return <Text className="text-sm text-typography-500">{t("admin.analytics.empty")}</Text>;
  }
  return <>{children}</>;
}
