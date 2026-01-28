/**
 * FailedOperationsSheet Component
 *
 * Bottom sheet listing failed sync operations with retry options.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { AlertCircle, RefreshCw, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useOfflineSafe } from "@/lib/database/offline-provider";
import type { SyncQueueItem } from "@/lib/database/schema";
import {
  deleteOperation,
  getFailedOperations,
  retryOperation,
} from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";

interface FailedOperationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Sheet displaying failed sync operations with retry/delete options
 */
export function FailedOperationsSheet({
  isOpen,
  onClose,
}: FailedOperationsSheetProps) {
  const { t } = useTranslation();
  const { isReady, getDb, sync, refreshPendingCount } = useOfflineSafe();

  const [failedOps, setFailedOps] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Load failed operations when sheet opens
  useEffect(() => {
    if (isOpen && isReady) {
      loadFailedOperations();
    }
  }, [isOpen, isReady]);

  const loadFailedOperations = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);
    try {
      const db = getDb();
      const ops = await getFailedOperations(db);
      setFailedOps(ops);
    } catch (error) {
      logger.error("Failed to load failed operations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getDb]);

  const handleRetryOne = useCallback(
    async (opId: string) => {
      if (!isReady) return;

      setRetryingIds((prev) => new Set(prev).add(opId));
      try {
        const db = getDb();
        await retryOperation(db, opId);
        await sync();
        await loadFailedOperations();
        await refreshPendingCount();
      } catch (error) {
        logger.error("Failed to retry operation:", error);
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(opId);
          return next;
        });
      }
    },
    [isReady, getDb, sync, loadFailedOperations, refreshPendingCount],
  );

  const handleDeleteOne = useCallback(
    async (opId: string) => {
      if (!isReady) return;

      try {
        const db = getDb();
        await deleteOperation(db, opId);
        await loadFailedOperations();
        await refreshPendingCount();
      } catch (error) {
        logger.error("Failed to delete operation:", error);
      }
    },
    [isReady, getDb, loadFailedOperations, refreshPendingCount],
  );

  const handleRetryAll = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);
    try {
      const db = getDb();
      for (const op of failedOps) {
        await retryOperation(db, op.id);
      }
      await sync();
      await loadFailedOperations();
      await refreshPendingCount();
    } catch (error) {
      logger.error("Failed to retry all operations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    getDb,
    failedOps,
    sync,
    loadFailedOperations,
    refreshPendingCount,
  ]);

  const handleDismissAll = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);
    try {
      const db = getDb();
      for (const op of failedOps) {
        await deleteOperation(db, op.id);
      }
      await loadFailedOperations();
      await refreshPendingCount();
    } catch (error) {
      logger.error("Failed to dismiss all operations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getDb, failedOps, loadFailedOperations, refreshPendingCount]);

  const getOperationLabel = (op: SyncQueueItem): string => {
    const tableLabels: Record<string, string> = {
      attendances: t("sync.table.attendance", { defaultValue: "Attendance" }),
      consumptions: t("sync.table.consumption", { defaultValue: "Drink" }),
      profiles: t("sync.table.profile", { defaultValue: "Profile" }),
    };

    const operationLabels: Record<string, string> = {
      INSERT: t("sync.operation.create", { defaultValue: "Create" }),
      UPDATE: t("sync.operation.update", { defaultValue: "Update" }),
      DELETE: t("sync.operation.delete", { defaultValue: "Delete" }),
    };

    const table = tableLabels[op.table_name] || op.table_name;
    const operation = operationLabels[op.operation] || op.operation;

    return `${operation} ${table}`;
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-background-0 pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full px-4 py-4">
          {/* Header */}
          <HStack className="items-center justify-between">
            <HStack space="sm" className="items-center">
              <AlertCircle size={20} color={IconColors.error} />
              <Heading size="md" className="text-typography-900">
                {t("sync.failedOps.title", {
                  defaultValue: "Failed Operations",
                })}
              </Heading>
            </HStack>
            <Pressable onPress={onClose} accessibilityLabel={t("common.close")}>
              <X size={24} color={IconColors.muted} />
            </Pressable>
          </HStack>

          {isLoading ? (
            <VStack className="items-center py-8">
              <Spinner size="large" color={Colors.primary[500]} />
            </VStack>
          ) : failedOps.length === 0 ? (
            <VStack className="items-center py-8">
              <Text className="text-typography-500">
                {t("sync.failedOps.noFailures", {
                  defaultValue: "No failed operations",
                })}
              </Text>
            </VStack>
          ) : (
            <>
              <Text className="text-sm text-typography-500">
                {t("sync.failedOps.description", {
                  defaultValue:
                    "These operations failed to sync. You can retry or dismiss them.",
                  count: failedOps.length,
                })}
              </Text>

              {/* Operation list */}
              <ScrollView style={{ maxHeight: 300 }}>
                <VStack space="sm">
                  {failedOps.map((op) => (
                    <HStack
                      key={op.id}
                      className="items-center justify-between rounded-lg border border-outline-200 bg-background-50 p-3"
                    >
                      <VStack className="flex-1">
                        <Text className="font-medium text-typography-900">
                          {getOperationLabel(op)}
                        </Text>
                        <Text
                          className="text-xs text-error-600"
                          numberOfLines={2}
                        >
                          {op.last_error ||
                            t("sync.failedOps.unknownError", {
                              defaultValue: "Unknown error",
                            })}
                        </Text>
                        <Text className="text-xs text-typography-400">
                          {t("sync.failedOps.attempts", {
                            defaultValue: "Attempts: {{count}}",
                            count: op.retry_count,
                          })}
                        </Text>
                      </VStack>
                      <HStack space="sm">
                        <Pressable
                          onPress={() => handleRetryOne(op.id)}
                          disabled={retryingIds.has(op.id)}
                          accessibilityLabel={t("sync.retry")}
                          className="rounded-full bg-primary-100 p-2"
                        >
                          {retryingIds.has(op.id) ? (
                            <Spinner size="small" color={Colors.primary[500]} />
                          ) : (
                            <RefreshCw size={16} color={Colors.primary[600]} />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteOne(op.id)}
                          accessibilityLabel={t("sync.dismiss")}
                          className="rounded-full bg-error-100 p-2"
                        >
                          <Trash2 size={16} color={Colors.error[600]} />
                        </Pressable>
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              </ScrollView>

              {/* Bulk actions */}
              <HStack space="md" className="mt-4">
                <Button
                  variant="outline"
                  action="secondary"
                  className="flex-1"
                  onPress={handleDismissAll}
                  isDisabled={isLoading}
                >
                  <ButtonIcon as={Trash2} />
                  <ButtonText>
                    {t("sync.failedOps.dismissAll", {
                      defaultValue: "Dismiss All",
                    })}
                  </ButtonText>
                </Button>
                <Button
                  action="primary"
                  className="flex-1"
                  onPress={handleRetryAll}
                  isDisabled={isLoading}
                >
                  <ButtonIcon as={RefreshCw} />
                  <ButtonText>
                    {t("sync.failedOps.retryAll", {
                      defaultValue: "Retry All",
                    })}
                  </ButtonText>
                </Button>
              </HStack>
            </>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
