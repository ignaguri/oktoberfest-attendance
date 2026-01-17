/**
 * Photo Upload Progress Component
 *
 * Displays progress indicators for pending photo uploads.
 * Shows upload status, progress bars, and error states.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Image,
  Upload,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

// =============================================================================
// Types
// =============================================================================

export interface PhotoUploadProgress {
  /** Photo ID */
  id: string;
  /** Local URI for preview */
  localUri: string;
  /** Progress value (0-100) */
  progress: number;
  /** Upload status */
  status: "pending" | "uploading" | "completed" | "failed";
  /** Error message if failed */
  error?: string;
}

interface UploadProgressProps {
  /** List of photos with their upload progress */
  photos: PhotoUploadProgress[];
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Called to start/retry uploads */
  onStartUpload?: () => void;
  /** Called to retry a specific failed upload */
  onRetry?: (photoId: string) => void;
  /** Called to cancel uploads */
  onCancel?: () => void;
  /** Additional className */
  className?: string;
}

interface UploadProgressBadgeProps {
  /** Number of pending photos */
  pendingCount: number;
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Called when badge is pressed */
  onPress?: () => void;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ICON_SIZE = 16;
const LARGE_ICON_SIZE = 24;

// =============================================================================
// Upload Progress List Component
// =============================================================================

export function UploadProgressList({
  photos,
  isUploading,
  onStartUpload,
  onRetry,
  onCancel,
  className = "",
}: UploadProgressProps) {
  const { t } = useTranslation();

  if (photos.length === 0) {
    return null;
  }

  const pendingCount = photos.filter((p) => p.status === "pending").length;
  const uploadingCount = photos.filter((p) => p.status === "uploading").length;
  const completedCount = photos.filter((p) => p.status === "completed").length;
  const failedCount = photos.filter((p) => p.status === "failed").length;

  const totalProgress =
    photos.length > 0
      ? Math.round(
          photos.reduce((acc, p) => acc + p.progress, 0) / photos.length,
        )
      : 0;

  return (
    <Card size="md" variant="elevated" className={cn("p-4", className)}>
      <VStack space="md">
        {/* Header */}
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            <Upload size={ICON_SIZE} color={Colors.primary[500]} />
            <Text className="text-typography-900 font-semibold">
              {t("photos.upload.title")}
            </Text>
          </HStack>

          {/* Status counts */}
          <HStack space="sm">
            {completedCount > 0 && (
              <HStack space="xs" className="items-center">
                <CheckCircle size={14} color={Colors.success[500]} />
                <Text className="text-success-500 text-xs">
                  {completedCount}
                </Text>
              </HStack>
            )}
            {failedCount > 0 && (
              <HStack space="xs" className="items-center">
                <AlertCircle size={14} color={Colors.error[500]} />
                <Text className="text-error-500 text-xs">{failedCount}</Text>
              </HStack>
            )}
            {pendingCount > 0 && (
              <HStack space="xs" className="items-center">
                <Clock size={14} color={Colors.gray[500]} />
                <Text className="text-typography-500 text-xs">
                  {pendingCount}
                </Text>
              </HStack>
            )}
          </HStack>
        </HStack>

        {/* Overall Progress */}
        {isUploading && (
          <VStack space="xs">
            <HStack className="items-center justify-between">
              <Text className="text-typography-600 text-sm">
                {t("photos.upload.uploading", {
                  current: completedCount + uploadingCount,
                  total: photos.length,
                })}
              </Text>
              <Text className="text-primary-500 text-sm font-medium">
                {totalProgress}%
              </Text>
            </HStack>
            <Progress value={totalProgress} size="sm">
              <ProgressFilledTrack />
            </Progress>
          </VStack>
        )}

        {/* Individual photo progress */}
        {photos.length <= 5 && (
          <VStack space="sm">
            {photos.map((photo) => (
              <PhotoProgressItem
                key={photo.id}
                photo={photo}
                onRetry={onRetry}
              />
            ))}
          </VStack>
        )}

        {/* Actions */}
        <HStack space="sm" className="justify-end">
          {isUploading && onCancel && (
            <Button variant="outline" size="sm" onPress={onCancel}>
              <ButtonText>{t("common.actions.cancel")}</ButtonText>
            </Button>
          )}
          {!isUploading && pendingCount > 0 && onStartUpload && (
            <Button size="sm" onPress={onStartUpload}>
              <ButtonText>{t("photos.upload.start")}</ButtonText>
            </Button>
          )}
          {!isUploading && failedCount > 0 && onStartUpload && (
            <Button variant="outline" size="sm" onPress={onStartUpload}>
              <ButtonText>{t("photos.upload.retry")}</ButtonText>
            </Button>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}

// =============================================================================
// Individual Photo Progress Item
// =============================================================================

interface PhotoProgressItemProps {
  photo: PhotoUploadProgress;
  onRetry?: (photoId: string) => void;
}

function PhotoProgressItem({ photo, onRetry }: PhotoProgressItemProps) {
  const { t } = useTranslation();
  const [spinValue] = useState(new Animated.Value(0));

  // Spinner animation for uploading state
  useEffect(() => {
    if (photo.status === "uploading") {
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
  }, [photo.status, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const getStatusIcon = () => {
    switch (photo.status) {
      case "completed":
        return <CheckCircle size={14} color={Colors.success[500]} />;
      case "failed":
        return <AlertCircle size={14} color={Colors.error[500]} />;
      case "uploading":
        return (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Upload size={14} color={Colors.primary[500]} />
          </Animated.View>
        );
      default:
        return <Clock size={14} color={Colors.gray[400]} />;
    }
  };

  return (
    <HStack className="items-center justify-between">
      <HStack space="sm" className="flex-1 items-center">
        <View className="bg-background-100 h-8 w-8 items-center justify-center rounded">
          <Image size={14} color={Colors.gray[500]} />
        </View>
        <VStack className="flex-1">
          <Text className="text-typography-700 text-sm" numberOfLines={1}>
            {photo.id.split("-").slice(-1)[0]}...
          </Text>
          {photo.status === "uploading" && (
            <Progress value={photo.progress} size="xs" className="mt-1">
              <ProgressFilledTrack />
            </Progress>
          )}
          {photo.status === "failed" && photo.error && (
            <Text className="text-error-500 text-xs" numberOfLines={1}>
              {photo.error}
            </Text>
          )}
        </VStack>
      </HStack>
      <HStack space="sm" className="items-center">
        {getStatusIcon()}
        {photo.status === "failed" && onRetry && (
          <Button variant="link" size="xs" onPress={() => onRetry(photo.id)}>
            <ButtonText className="text-xs">
              {t("common.actions.retry")}
            </ButtonText>
          </Button>
        )}
      </HStack>
    </HStack>
  );
}

// =============================================================================
// Compact Upload Progress Badge
// =============================================================================

export function UploadProgressBadge({
  pendingCount,
  isUploading,
  onPress,
  className = "",
}: UploadProgressBadgeProps) {
  const { t } = useTranslation();
  const [spinValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isUploading) {
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
  }, [isUploading, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (pendingCount === 0 && !isUploading) {
    return null;
  }

  const getBgColor = () => {
    if (isUploading) return "bg-primary-100";
    return "bg-background-200";
  };

  return (
    <Button
      variant="link"
      size="sm"
      onPress={onPress}
      className={cn("rounded-full px-3 py-1", getBgColor(), className)}
    >
      <HStack space="xs" className="items-center">
        {isUploading ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Upload size={12} color={Colors.primary[500]} />
          </Animated.View>
        ) : (
          <Clock size={12} color={Colors.gray[500]} />
        )}
        <Text
          className={cn(
            "text-xs",
            isUploading ? "text-primary-600" : "text-typography-600",
          )}
        >
          {isUploading
            ? t("photos.upload.inProgress")
            : t("photos.upload.pending", { count: pendingCount })}
        </Text>
      </HStack>
    </Button>
  );
}

// =============================================================================
// Upload Summary Card
// =============================================================================

interface UploadSummaryProps {
  /** Total photos to upload */
  total: number;
  /** Completed uploads */
  completed: number;
  /** Failed uploads */
  failed: number;
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Called to dismiss the summary */
  onDismiss?: () => void;
  /** Additional className */
  className?: string;
}

export function UploadSummaryCard({
  total,
  completed,
  failed,
  isUploading,
  onDismiss,
  className = "",
}: UploadSummaryProps) {
  const { t } = useTranslation();

  if (total === 0) {
    return null;
  }

  const allComplete = completed + failed === total && !isUploading;
  const allSuccess = allComplete && failed === 0;

  return (
    <Card
      size="sm"
      variant="elevated"
      className={cn(
        "p-3",
        allSuccess && "bg-success-50",
        allComplete && failed > 0 && "bg-error-50",
        className,
      )}
    >
      <HStack className="items-center justify-between">
        <HStack space="sm" className="items-center">
          {isUploading ? (
            <ButtonSpinner color={Colors.primary[500]} />
          ) : allSuccess ? (
            <CheckCircle size={LARGE_ICON_SIZE} color={Colors.success[500]} />
          ) : failed > 0 ? (
            <AlertCircle size={LARGE_ICON_SIZE} color={Colors.error[500]} />
          ) : (
            <Image size={LARGE_ICON_SIZE} color={Colors.gray[500]} />
          )}
          <VStack>
            <Text
              className={cn(
                "font-medium",
                allSuccess
                  ? "text-success-700"
                  : failed > 0
                    ? "text-error-700"
                    : "text-typography-900",
              )}
            >
              {isUploading
                ? t("photos.upload.uploading", { current: completed, total })
                : allSuccess
                  ? t("photos.upload.complete")
                  : t("photos.upload.partial", { completed, failed })}
            </Text>
            {isUploading && (
              <Progress
                value={Math.round((completed / total) * 100)}
                size="xs"
                className="mt-1 w-32"
              >
                <ProgressFilledTrack />
              </Progress>
            )}
          </VStack>
        </HStack>
        {allComplete && onDismiss && (
          <Button variant="link" size="sm" onPress={onDismiss}>
            <ButtonText>{t("common.actions.dismiss")}</ButtonText>
          </Button>
        )}
      </HStack>
    </Card>
  );
}

export default UploadProgressList;
