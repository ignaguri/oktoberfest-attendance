/**
 * Offline Indicator Component
 *
 * Displays sync status and offline state to users.
 * Shows different states: syncing, offline, pending changes, error.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Colors } from "@/lib/constants/colors";
import {
  useIsOnline,
  useOfflineSafe,
  usePendingCount,
} from "@/lib/database/offline-provider";
import { logger } from "@/lib/logger";

// =============================================================================
// Types
// =============================================================================

interface OfflineIndicatorProps {
  /** Whether to show detailed status text */
  showText?: boolean;
  /** Size of the indicator */
  size?: "sm" | "md" | "lg";
  /** Called when indicator is pressed */
  onPress?: () => void;
  /** Additional className for styling */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ICON_SIZES = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

const TEXT_CLASSES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

// =============================================================================
// Component
// =============================================================================

export function OfflineIndicator({
  showText = true,
  size = "md",
  onPress,
  className = "",
}: OfflineIndicatorProps) {
  const { t } = useTranslation();
  const { syncStatus, pendingCount, sync } = useOfflineSafe();
  const isOnline = useIsOnline();

  // Animation for syncing state
  const [spinValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (syncStatus === "syncing") {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncStatus, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const iconSize = ICON_SIZES[size];
  const textClass = TEXT_CLASSES[size];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isOnline && syncStatus !== "syncing") {
      // Trigger manual sync
      sync().catch((error) => logger.error("Manual sync failed", error));
    }
  };

  // Determine what to show based on state
  const renderContent = () => {
    // Offline state
    if (!isOnline) {
      return (
        <>
          <CloudOff size={iconSize} color={Colors.gray[500]} />
          {showText && (
            <Text className={cn(textClass, "text-typography-500")}>
              {t("offline.status.offline")}
            </Text>
          )}
        </>
      );
    }

    // Syncing state
    if (syncStatus === "syncing") {
      return (
        <>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={iconSize} color={Colors.primary[500]} />
          </Animated.View>
          {showText && (
            <Text className={cn(textClass, "text-primary-500")}>
              {t("offline.status.syncing")}
            </Text>
          )}
        </>
      );
    }

    // Error state
    if (syncStatus === "error") {
      return (
        <>
          <AlertCircle size={iconSize} color={Colors.error[500]} />
          {showText && (
            <Text className={cn(textClass, "text-error-500")}>
              {t("offline.status.error")}
            </Text>
          )}
        </>
      );
    }

    // Pending changes
    if (pendingCount > 0) {
      return (
        <>
          <Cloud size={iconSize} color={Colors.primary[500]} />
          {showText && (
            <Text className={cn(textClass, "text-primary-500")}>
              {t("offline.status.pending", { count: pendingCount })}
            </Text>
          )}
        </>
      );
    }

    // All synced
    return (
      <>
        <Check size={iconSize} color={Colors.success[500]} />
        {showText && (
          <Text className={cn(textClass, "text-success-500")}>
            {t("offline.status.synced")}
          </Text>
        )}
      </>
    );
  };

  return (
    <Pressable onPress={handlePress} disabled={syncStatus === "syncing"}>
      <HStack space="xs" className={cn("items-center", className)}>
        {renderContent()}
      </HStack>
    </Pressable>
  );
}

// =============================================================================
// Compact Badge Version
// =============================================================================

interface OfflineBadgeProps {
  /** Additional className */
  className?: string;
}

/**
 * Compact badge that only shows when offline or has pending changes.
 * Useful for headers or tab bars.
 */
export function OfflineBadge({ className = "" }: OfflineBadgeProps) {
  const isOnline = useIsOnline();
  const pendingCount = usePendingCount();
  const { syncStatus } = useOfflineSafe();

  // Don't show if online and no pending changes
  if (isOnline && pendingCount === 0 && syncStatus !== "syncing") {
    return null;
  }

  const getBgColor = () => {
    if (!isOnline) return "bg-background-300";
    if (syncStatus === "syncing") return "bg-primary-100";
    if (syncStatus === "error") return "bg-error-100";
    return "bg-primary-100";
  };

  const getIconColor = () => {
    if (!isOnline) return Colors.gray[500];
    if (syncStatus === "syncing") return Colors.primary[500];
    if (syncStatus === "error") return Colors.error[500];
    return Colors.primary[500];
  };

  return (
    <HStack
      space="xs"
      className={cn(
        "items-center rounded-full px-2 py-1",
        getBgColor(),
        className,
      )}
    >
      {!isOnline ? (
        <CloudOff size={12} color={getIconColor()} />
      ) : syncStatus === "syncing" ? (
        <RefreshCw size={12} color={getIconColor()} />
      ) : syncStatus === "error" ? (
        <AlertCircle size={12} color={getIconColor()} />
      ) : (
        <Cloud size={12} color={getIconColor()} />
      )}
      {pendingCount > 0 && (
        <Text className="text-xs text-primary-600">{pendingCount}</Text>
      )}
    </HStack>
  );
}

// =============================================================================
// Offline Banner
// =============================================================================

interface OfflineBannerProps {
  /** Additional className */
  className?: string;
}

/**
 * Full-width banner that shows when offline.
 * Displays at top of screen to inform user.
 */
export function OfflineBanner({ className = "" }: OfflineBannerProps) {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const { syncStatus, error, pendingCount } = useOfflineSafe();

  // Don't show if online and everything is fine
  if (isOnline && syncStatus !== "error") {
    return null;
  }

  const getBgColor = () => {
    if (!isOnline) return "bg-background-200";
    if (syncStatus === "error") return "bg-error-100";
    return "bg-primary-100";
  };

  const getTextColor = () => {
    if (!isOnline) return "text-typography-700";
    if (syncStatus === "error") return "text-error-700";
    return "text-primary-700";
  };

  const getMessage = () => {
    if (!isOnline) {
      if (pendingCount > 0) {
        return t("offline.banner.offlineWithPending", { count: pendingCount });
      }
      return t("offline.banner.offline");
    }
    if (syncStatus === "error") {
      return error || t("offline.banner.error");
    }
    return "";
  };

  return (
    <HStack
      space="sm"
      className={cn(
        "items-center justify-center px-4 py-2",
        getBgColor(),
        className,
      )}
    >
      {!isOnline ? (
        <CloudOff size={16} color={Colors.gray[500]} />
      ) : (
        <AlertCircle size={16} color={Colors.error[500]} />
      )}
      <Text className={cn("text-sm", getTextColor())}>{getMessage()}</Text>
    </HStack>
  );
}

export default OfflineIndicator;
