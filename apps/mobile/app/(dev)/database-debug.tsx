/**
 * Database Debug Screen
 *
 * Developer tool for inspecting and debugging offline-first functionality.
 * Only accessible in development mode.
 */

import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import {
  DatabaseDebugger,
  type DatabaseStats,
  type SyncQueueEntry,
  type DirtyRecord,
} from "@/lib/database/debug";
import { useOffline } from "@/lib/database/offline-provider";
import {
  Database,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  XCircle,
  WifiOff,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, RefreshControl, Switch } from "react-native";

// =============================================================================
// Main Screen
// =============================================================================

export default function DatabaseDebugScreen() {
  const {
    isReady,
    getDb,
    sync,
    syncStatus,
    isSimulatingOffline,
    setSimulateOffline,
  } = useOffline();

  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [pendingOps, setPendingOps] = useState<SyncQueueEntry[]>([]);
  const [dirtyRecords, setDirtyRecords] = useState<DirtyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!isReady) return;

    try {
      const db = getDb();
      const [statsData, opsData, dirtyData] = await Promise.all([
        DatabaseDebugger.getStats(db),
        DatabaseDebugger.getPendingSync(db),
        DatabaseDebugger.getDirtyRecords(db),
      ]);

      setStats(statsData);
      setPendingOps(opsData);
      setDirtyRecords(dirtyData);
    } catch (error) {
      console.error("[Debug] Failed to load data:", error);
    }
  }, [isReady, getDb]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  // Actions
  const handleForceSync = useCallback(async () => {
    setIsLoading(true);
    try {
      await sync({ direction: "both" });
      await loadData();
      Alert.alert("Success", "Sync completed");
    } catch (error) {
      Alert.alert("Error", "Sync failed: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sync, loadData]);

  const handleRetryFailed = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);
    try {
      const db = getDb();
      const count = await DatabaseDebugger.retryAllFailed(db);
      await loadData();
      Alert.alert("Success", `Retrying ${count} failed operations`);
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getDb, loadData]);

  const handleDeleteFailed = useCallback(async () => {
    if (!isReady) return;

    Alert.alert(
      "Delete Failed Operations",
      "This will permanently delete all failed sync operations. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const db = getDb();
              const count = await DatabaseDebugger.deleteFailed(db);
              await loadData();
              Alert.alert("Success", `Deleted ${count} failed operations`);
            } catch (error) {
              Alert.alert("Error", (error as Error).message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, [isReady, getDb, loadData]);

  const handleClearCompleted = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);
    try {
      const db = getDb();
      const count = await DatabaseDebugger.clearCompletedSync(db);
      await loadData();
      Alert.alert("Success", `Cleared ${count} completed operations`);
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getDb, loadData]);

  const handleExportDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const path = await DatabaseDebugger.exportDb();
      if (path) {
        Alert.alert("Success", "Database exported");
      } else {
        Alert.alert("Error", "Export failed");
      }
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogState = useCallback(async () => {
    if (!isReady) return;

    try {
      const db = getDb();
      await DatabaseDebugger.logState(db);
      Alert.alert("Success", "Database state logged to console");
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    }
  }, [isReady, getDb]);

  const handleResetDatabase = useCallback(() => {
    Alert.alert(
      "Reset Database",
      "This will delete all local data. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await DatabaseDebugger.resetDb();
              setStats(null);
              setPendingOps([]);
              setDirtyRecords([]);
              Alert.alert("Success", "Database reset. Please restart the app.");
            } catch (error) {
              Alert.alert("Error", (error as Error).message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!isReady) {
    return (
      <VStack className="flex-1 items-center justify-center p-4">
        <ButtonSpinner color={Colors.primary[500]} />
        <Text className="text-typography-500 mt-2">Loading database...</Text>
      </VStack>
    );
  }

  return (
    <ScrollView
      className="bg-background-50 flex-1"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <VStack space="md" className="p-4">
        {/* Header */}
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            <Database size={24} color={Colors.primary[500]} />
            <Heading size="xl">Database Debug</Heading>
          </HStack>
          <HStack space="sm">
            <SyncStatusBadge status={syncStatus} />
          </HStack>
        </HStack>

        {/* Quick Stats */}
        {stats && (
          <Card size="md" variant="elevated" className="p-4">
            <VStack space="sm">
              <Heading size="sm">Quick Stats</Heading>
              <HStack className="flex-wrap gap-4">
                <StatBadge
                  label="DB Size"
                  value={`${(stats.databaseSizeBytes / 1024 / 1024).toFixed(2)} MB`}
                  icon={<Database size={14} color={IconColors.default} />}
                />
                <StatBadge
                  label="Pending Sync"
                  value={stats.syncQueue.pending.toString()}
                  icon={<Clock size={14} color={Colors.primary[500]} />}
                  color={stats.syncQueue.pending > 0 ? "primary" : undefined}
                />
                <StatBadge
                  label="Failed"
                  value={stats.syncQueue.failed.toString()}
                  icon={<XCircle size={14} color={Colors.error[500]} />}
                  color={stats.syncQueue.failed > 0 ? "error" : undefined}
                />
                <StatBadge
                  label="Photos Pending"
                  value={stats.photos.pending.toString()}
                  icon={<Upload size={14} color={Colors.primary[500]} />}
                />
              </HStack>
            </VStack>
          </Card>
        )}

        {/* Actions */}
        <Card size="md" variant="elevated" className="p-4">
          <VStack space="sm">
            <Heading size="sm">Actions</Heading>
            <HStack className="flex-wrap gap-2">
              <Button
                size="sm"
                onPress={handleForceSync}
                disabled={isLoading || syncStatus === "syncing"}
              >
                {syncStatus === "syncing" ? (
                  <ButtonSpinner color={Colors.white} />
                ) : (
                  <RefreshCw size={14} color={Colors.white} />
                )}
                <ButtonText className="ml-1">Force Sync</ButtonText>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleRetryFailed}
                disabled={isLoading || stats?.syncQueue.failed === 0}
              >
                <AlertCircle size={14} color={Colors.primary[500]} />
                <ButtonText className="ml-1">Retry Failed</ButtonText>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleDeleteFailed}
                disabled={isLoading || stats?.syncQueue.failed === 0}
              >
                <XCircle size={14} color={Colors.error[500]} />
                <ButtonText className="text-error-500 ml-1">
                  Delete Failed
                </ButtonText>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleClearCompleted}
                disabled={isLoading}
              >
                <CheckCircle size={14} color={Colors.primary[500]} />
                <ButtonText className="ml-1">Clear Done</ButtonText>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleExportDatabase}
                disabled={isLoading}
              >
                <Download size={14} color={Colors.primary[500]} />
                <ButtonText className="ml-1">Export</ButtonText>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleLogState}
                disabled={isLoading}
              >
                <Database size={14} color={Colors.primary[500]} />
                <ButtonText className="ml-1">Log State</ButtonText>
              </Button>
            </HStack>

            <Divider className="my-2" />

            {/* Simulate Offline Toggle */}
            <HStack className="items-center justify-between py-2">
              <HStack space="sm" className="items-center">
                <WifiOff
                  size={18}
                  color={
                    isSimulatingOffline ? Colors.error[500] : IconColors.default
                  }
                />
                <VStack>
                  <Text className="font-medium">Simulate Offline</Text>
                  <Text size="xs" className="text-typography-500">
                    {isSimulatingOffline
                      ? "Network blocked for testing"
                      : "Toggle to test offline mode"}
                  </Text>
                </VStack>
              </HStack>
              <Switch
                value={isSimulatingOffline}
                onValueChange={(value) => {
                  console.log("[Debug] Simulate Offline toggled to:", value);
                  setSimulateOffline(value);
                }}
                trackColor={{ false: "#d1d5db", true: Colors.error[500] }}
                thumbColor={isSimulatingOffline ? "#fff" : "#f4f3f4"}
              />
            </HStack>

            <Divider className="my-2" />

            <Button
              size="sm"
              action="negative"
              onPress={handleResetDatabase}
              disabled={isLoading}
            >
              <Trash2 size={14} color={Colors.white} />
              <ButtonText className="ml-1">Reset Database</ButtonText>
            </Button>
          </VStack>
        </Card>

        {/* Table Stats */}
        {stats && (
          <CollapsibleSection
            title="Table Statistics"
            subtitle={`${stats.tables.filter((t) => t.totalRows > 0).length} tables with data`}
            isExpanded={expandedSection === "tables"}
            onToggle={() => toggleSection("tables")}
          >
            <VStack space="xs" className="mt-2">
              {stats.tables
                .filter((t) => t.totalRows > 0 || t.dirtyRows > 0)
                .map((table) => (
                  <HStack
                    key={table.name}
                    className="bg-background-100 items-center justify-between rounded p-2"
                  >
                    <Text className="font-mono text-sm">{table.name}</Text>
                    <HStack space="sm">
                      <Text className="text-typography-500 text-xs">
                        {table.totalRows} rows
                      </Text>
                      {table.dirtyRows > 0 && (
                        <Text className="text-primary-500 text-xs">
                          {table.dirtyRows} dirty
                        </Text>
                      )}
                      {table.deletedRows > 0 && (
                        <Text className="text-error-500 text-xs">
                          {table.deletedRows} deleted
                        </Text>
                      )}
                    </HStack>
                  </HStack>
                ))}
            </VStack>
          </CollapsibleSection>
        )}

        {/* Pending Operations */}
        <CollapsibleSection
          title="Sync Queue"
          subtitle={`${pendingOps.length} pending operations`}
          isExpanded={expandedSection === "queue"}
          onToggle={() => toggleSection("queue")}
        >
          <VStack space="xs" className="mt-2">
            {pendingOps.length === 0 ? (
              <Text className="text-typography-500 text-center text-sm">
                No pending operations
              </Text>
            ) : (
              pendingOps.slice(0, 20).map((op) => (
                <HStack
                  key={op.id}
                  className="bg-background-100 items-center justify-between rounded p-2"
                >
                  <VStack className="flex-1">
                    <HStack space="xs" className="items-center">
                      <StatusIcon status={op.status} />
                      <Text className="font-mono text-xs">
                        {op.operation} {op.table_name}
                      </Text>
                    </HStack>
                    {op.last_error && (
                      <Text
                        className="text-error-500 text-xs"
                        numberOfLines={1}
                      >
                        {op.last_error}
                      </Text>
                    )}
                  </VStack>
                  <Text className="text-typography-400 text-xs">
                    {op.retry_count > 0 && `(${op.retry_count}x)`}
                  </Text>
                </HStack>
              ))
            )}
            {pendingOps.length > 20 && (
              <Text className="text-typography-400 text-center text-xs">
                +{pendingOps.length - 20} more
              </Text>
            )}
          </VStack>
        </CollapsibleSection>

        {/* Dirty Records */}
        <CollapsibleSection
          title="Dirty Records"
          subtitle={`${dirtyRecords.length} unsynced changes`}
          isExpanded={expandedSection === "dirty"}
          onToggle={() => toggleSection("dirty")}
        >
          <VStack space="xs" className="mt-2">
            {dirtyRecords.length === 0 ? (
              <Text className="text-typography-500 text-center text-sm">
                All records synced
              </Text>
            ) : (
              dirtyRecords.slice(0, 20).map((record) => (
                <HStack
                  key={`${record.table}-${record.id}`}
                  className="bg-background-100 items-center justify-between rounded p-2"
                >
                  <VStack className="flex-1">
                    <Text className="font-mono text-xs">
                      {record.table}/{record.id.substring(0, 8)}...
                    </Text>
                    <Text
                      className={`text-xs ${
                        record.operation === "DELETE"
                          ? "text-error-500"
                          : record.operation === "INSERT"
                            ? "text-success-500"
                            : "text-primary-500"
                      }`}
                    >
                      {record.operation}
                    </Text>
                  </VStack>
                </HStack>
              ))
            )}
            {dirtyRecords.length > 20 && (
              <Text className="text-typography-400 text-center text-xs">
                +{dirtyRecords.length - 20} more
              </Text>
            )}
          </VStack>
        </CollapsibleSection>

        {/* Bottom spacing */}
        <VStack className="h-20" />
      </VStack>
    </ScrollView>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function SyncStatusBadge({ status }: { status: string }) {
  const getColor = () => {
    switch (status) {
      case "syncing":
        return "bg-primary-100 text-primary-700";
      case "error":
        return "bg-error-100 text-error-700";
      case "offline":
        return "bg-background-200 text-typography-600";
      default:
        return "bg-success-100 text-success-700";
    }
  };

  return (
    <Text
      className={`rounded-full px-2 py-1 text-xs font-medium ${getColor()}`}
    >
      {status}
    </Text>
  );
}

function StatBadge({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: "primary" | "error";
}) {
  const bgColor =
    color === "primary"
      ? "bg-primary-50"
      : color === "error"
        ? "bg-error-50"
        : "bg-background-100";

  return (
    <VStack className={`items-center rounded-lg p-2 ${bgColor}`}>
      {icon}
      <Text className="text-lg font-semibold">{value}</Text>
      <Text className="text-typography-500 text-xs">{label}</Text>
    </VStack>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle size={12} color={Colors.success[500]} />;
    case "failed":
      return <XCircle size={12} color={Colors.error[500]} />;
    case "processing":
      return <RefreshCw size={12} color={Colors.primary[500]} />;
    default:
      return <Clock size={12} color={Colors.gray[400]} />;
  }
}

function CollapsibleSection({
  title,
  subtitle,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card size="md" variant="elevated" className="overflow-hidden">
      <Pressable onPress={onToggle} className="p-4">
        <HStack className="items-center justify-between">
          <VStack>
            <Heading size="sm">{title}</Heading>
            <Text className="text-typography-500 text-xs">{subtitle}</Text>
          </VStack>
          <ChevronRight
            size={20}
            color={IconColors.default}
            style={{
              transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
            }}
          />
        </HStack>
      </Pressable>
      {isExpanded && <VStack className="px-4 pb-4">{children}</VStack>}
    </Card>
  );
}
