import { useAdminWrappedCache, useRegenerateWrappedCache } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { Database, RefreshCw } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/**
 * Wrapped data cache management.
 *
 * The web panel's equivalent is two free-text UUID boxes, which is unusable on
 * a phone. Listing the entries instead means the filters are the rows: tap one
 * to recalculate that user's Wrapped for that festival.
 *
 * Nothing here can create a cache entry. `regenerate_wrapped_data_cache` only
 * updates rows that already exist, and rows appear the first time a user opens
 * their own Wrapped, so an untouched account has nothing to refresh.
 */
export default function AdminCacheScreen() {
  const { t } = useTranslation();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { entries, isLoading, error, refetch } = useAdminWrappedCache();
  const regenerate = useRegenerateWrappedCache();

  // Tracked per row so only the tapped entry shows a spinner. "all" is the
  // header button, which no entry id can collide with.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const runRegeneration = useCallback(
    async (busyKey: string, filters: { festivalId?: string; userId?: string }) => {
      if (busyId !== null) {
        return;
      }

      setBusyId(busyKey);
      try {
        const result = await regenerate.mutate(filters);
        showDialog(
          t("common.status.success"),
          t("admin.mobile.cache.regenerateSuccess", { count: result.regeneratedCount ?? 0 }),
        );
      } catch {
        showDialog(t("common.status.error"), t("admin.mobile.cache.regenerateError"));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, regenerate, showDialog, t],
  );

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background-50"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isPullRefreshing} onRefresh={handlePullRefresh} />
        }
      >
        <VStack space="md">
          <Text className="text-sm text-typography-500">{t("admin.mobile.cache.description")}</Text>

          <Button
            variant="outline"
            onPress={() => runRegeneration("all", {})}
            isDisabled={busyId !== null || entries.length === 0}
            accessibilityLabel={t("admin.mobile.cache.regenerateAll")}
            accessibilityHint={t("admin.mobile.cache.regenerateAllHint")}
          >
            {busyId === "all" ? (
              <ButtonSpinner />
            ) : (
              <RefreshCw size={16} color={IconColors.default} />
            )}
            <ButtonText>
              {busyId === "all"
                ? t("admin.mobile.cache.regenerating")
                : t("admin.mobile.cache.regenerateAll")}
            </ButtonText>
          </Button>

          {isLoading && <Text className="text-typography-500">{t("common.status.loading")}</Text>}

          {!isLoading && entries.length === 0 && (
            <Card size="md" variant="elevated">
              <VStack space="xs" className="items-center py-6">
                <Database size={32} color={IconColors.muted} />
                <Text className="text-typography-500">{t("admin.mobile.cache.empty")}</Text>
                <Text className="text-center text-sm text-typography-400">
                  {t("admin.mobile.cache.emptyHint")}
                </Text>
              </VStack>
            </Card>
          )}

          {entries.map((entry) => (
            <Card key={entry.id} size="md" variant="elevated">
              <VStack space="sm">
                <View>
                  <Text className="font-semibold text-typography-900">
                    {entry.full_name || entry.username || t("common.unknownUser")}
                  </Text>
                  <Text className="text-sm text-typography-500">{entry.festival_name}</Text>
                </View>

                <HStack space="md">
                  <View className="flex-1">
                    <Text className="text-xs text-typography-400">
                      {t("admin.mobile.cache.columns.firstGenerated")}
                    </Text>
                    <Text className="text-sm text-typography-700">
                      {formatRelativeTime(new Date(entry.created_at))}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-typography-400">
                      {t("admin.mobile.cache.columns.lastRefreshed")}
                    </Text>
                    <Text className="text-sm text-typography-700">
                      {formatRelativeTime(new Date(entry.updated_at))}
                    </Text>
                  </View>
                </HStack>

                <Text className="text-xs text-typography-400">
                  {t(`admin.mobile.cache.source.${entry.generated_by}`)}
                </Text>

                <Button
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    runRegeneration(entry.id, {
                      festivalId: entry.festival_id,
                      userId: entry.user_id,
                    })
                  }
                  isDisabled={busyId !== null}
                  accessibilityLabel={t("admin.mobile.cache.regenerateEntry")}
                  accessibilityHint={t("admin.mobile.cache.regenerateEntryHint")}
                >
                  {busyId === entry.id ? (
                    <ButtonSpinner />
                  ) : (
                    <RefreshCw size={16} color={IconColors.default} />
                  )}
                  <ButtonText>
                    {busyId === entry.id
                      ? t("admin.mobile.cache.regenerating")
                      : t("admin.mobile.cache.regenerateEntry")}
                  </ButtonText>
                </Button>
              </VStack>
            </Card>
          ))}
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
