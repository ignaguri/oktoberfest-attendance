import {
  useAdminLocationSessions,
  useCleanupExpiredLocationSessions,
  useForceStopLocationSession,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { MapPin, Trash2 } from "lucide-react-native";
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

export default function AdminLocationScreen() {
  const { t } = useTranslation();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { sessions, isLoading, error, refetch, isRefetching } = useAdminLocationSessions();
  const forceStop = useForceStopLocationSession();
  const cleanup = useCleanupExpiredLocationSessions();

  // Tracked per row so only the tapped session shows a spinner.
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const handleForceStop = useCallback(
    (sessionId: string) => {
      showDialog(
        t("admin.location.forceStop"),
        t("admin.mobile.location.forceStopConfirm"),
        "destructive",
        async () => {
          setStoppingId(sessionId);
          try {
            await forceStop.mutate(sessionId);
          } catch {
            showDialog(t("common.status.error"), t("admin.location.stopError"));
          } finally {
            setStoppingId(null);
          }
        },
      );
    },
    [forceStop, showDialog, t],
  );

  const handleCleanup = useCallback(async () => {
    try {
      const result = await cleanup.mutate(undefined);
      showDialog(
        t("common.status.success"),
        t("admin.location.cleanupSuccess", { count: result.cleanedCount }),
      );
    } catch {
      showDialog(t("common.status.error"), t("admin.location.cleanupError"));
    }
  }, [cleanup, showDialog, t]);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background-50"
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isRefetching ?? false} onRefresh={refetch} />}
      >
        <VStack space="md">
          <Button
            variant="outline"
            onPress={handleCleanup}
            isDisabled={cleanup.loading}
            accessibilityLabel={t("admin.location.cleanupExpired")}
            accessibilityHint={t("admin.mobile.location.cleanupHint")}
          >
            {cleanup.loading && <ButtonSpinner />}
            <ButtonText>
              {cleanup.loading ? t("admin.location.cleaning") : t("admin.location.cleanupExpired")}
            </ButtonText>
          </Button>

          {isLoading && <Text className="text-typography-500">{t("admin.location.loading")}</Text>}

          {!isLoading && sessions.length === 0 && (
            <Card size="md" variant="elevated">
              <VStack space="xs" className="items-center py-6">
                <MapPin size={32} color={IconColors.muted} />
                <Text className="text-typography-500">{t("admin.location.noSessions")}</Text>
              </VStack>
            </Card>
          )}

          {sessions.map((session) => (
            <Card key={session.id} size="md" variant="elevated">
              <VStack space="sm">
                <View>
                  <Text className="font-semibold text-typography-900">
                    {session.user.fullName || session.user.username || t("common.unknownUser")}
                  </Text>
                  <Text className="text-sm text-typography-500">{session.festival.name}</Text>
                </View>

                <HStack space="md">
                  <View className="flex-1">
                    <Text className="text-xs text-typography-400">
                      {t("admin.location.columns.startedAt")}
                    </Text>
                    <Text className="text-sm text-typography-700">
                      {formatRelativeTime(new Date(session.startedAt))}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-typography-400">
                      {t("admin.location.columns.expiresAt")}
                    </Text>
                    <Text className="text-sm text-typography-700">
                      {formatRelativeTime(new Date(session.expiresAt))}
                    </Text>
                  </View>
                </HStack>

                <Button
                  variant="outline"
                  action="negative"
                  size="sm"
                  onPress={() => handleForceStop(session.id)}
                  isDisabled={stoppingId === session.id}
                  accessibilityLabel={t("admin.location.forceStop")}
                  accessibilityHint={t("admin.mobile.location.forceStopHint")}
                >
                  {stoppingId === session.id ? (
                    <ButtonSpinner />
                  ) : (
                    <Trash2 size={16} color={IconColors.error} />
                  )}
                  <ButtonText>
                    {stoppingId === session.id
                      ? t("admin.location.stopping")
                      : t("admin.location.forceStop")}
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
