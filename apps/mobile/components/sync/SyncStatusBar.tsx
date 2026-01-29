/**
 * SyncStatusBar Component
 *
 * A persistent banner showing sync state:
 * - Syncing: Shows spinner with "Syncing..."
 * - Error: Shows error icon with tap to retry
 * - Offline: Shows offline indicator
 * - Pending: Shows pending count badge
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useOfflineSafe } from "@/lib/database/offline-provider";

interface SyncStatusBarProps {
  /** Callback when user taps on errors to see details */
  onViewErrors?: () => void;
  /** Whether to show the bar even when idle with no issues */
  alwaysShow?: boolean;
}

export function SyncStatusBar({
  onViewErrors,
  alwaysShow = false,
}: SyncStatusBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    isReady,
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncResult,
    error,
    sync,
  } = useOfflineSafe();

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await sync();
    } finally {
      setIsRetrying(false);
    }
  }, [sync]);

  // Don't render if offline provider not available
  if (!isReady && !alwaysShow) {
    return null;
  }

  // Determine what to show
  const isSyncing = syncStatus === "syncing" || isRetrying;
  const hasError = syncStatus === "error" || (lastSyncResult?.failed ?? 0) > 0;
  const isOffline = !isOnline || syncStatus === "offline";
  const hasPending = pendingCount > 0;

  // Don't render if everything is fine and not forced to show
  if (!alwaysShow && !isSyncing && !hasError && !isOffline && !hasPending) {
    return null;
  }

  // Determine status icon and colors
  let icon;
  let statusText;
  let bgColor = "bg-background-50";
  let textColor = "text-typography-500";

  if (isSyncing) {
    icon = <Spinner size="small" color={Colors.primary[500]} />;
    statusText = t("sync.status.syncing");
    bgColor = "bg-primary-50";
    textColor = "text-primary-700";
  } else if (isOffline) {
    icon = <CloudOff size={16} color={IconColors.muted} />;
    statusText = t("sync.status.offline");
    bgColor = "bg-background-100";
    textColor = "text-typography-500";
  } else if (hasError) {
    icon = <AlertCircle size={16} color={IconColors.error} />;
    statusText = error || t("sync.status.error");
    bgColor = "bg-error-50";
    textColor = "text-error-700";
  } else if (hasPending) {
    icon = <Cloud size={16} color={Colors.primary[500]} />;
    statusText = t("sync.status.pending", {
      count: pendingCount,
    });
    bgColor = "bg-primary-50";
    textColor = "text-primary-700";
  } else {
    icon = <CheckCircle size={16} color={IconColors.success} />;
    statusText = t("sync.status.synced");
    bgColor = "bg-success-50";
    textColor = "text-success-700";
  }

  const isInteractive = hasError || hasPending;

  const content = (
    <HStack
      space="sm"
      className={cn("items-center justify-center px-4 py-2", bgColor)}
    >
      {icon}
      <Text className={cn("text-xs", textColor)} numberOfLines={1}>
        {statusText}
      </Text>
      {isInteractive && !isSyncing && (
        <RefreshCw size={14} color={IconColors.muted} />
      )}
    </HStack>
  );

  // Wrap in a View with safe area padding for dynamic island/notch
  const wrappedContent = (
    <View style={{ paddingTop: insets.top }} className={cn(bgColor)}>
      {content}
    </View>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={hasError ? (onViewErrors ?? handleRetry) : handleRetry}
        accessibilityRole="button"
        accessibilityLabel={
          hasError ? t("sync.tapToRetry") : t("sync.tapToSync")
        }
        style={{ paddingTop: insets.top }}
        className={cn(bgColor)}
      >
        {content}
      </Pressable>
    );
  }

  return wrappedContent;
}
