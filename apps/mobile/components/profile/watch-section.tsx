import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Check, CircleDashed, Radio, RefreshCw, Watch, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useWatchState } from "@/hooks/useWatchState";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";
import { forceSyncSessionToWatch, pingWatch } from "@/lib/watch-sync";

function StatusPill({ label, active }: { label: string; active: boolean }) {
  const Icon = active ? Check : CircleDashed;
  return (
    <HStack className="items-center gap-1 rounded-full bg-background-100 px-2 py-1">
      <Icon size={14} color={active ? IconColors.success : IconColors.muted} />
      <Text className="text-xs text-typography-700">{label}</Text>
    </HStack>
  );
}

export function WatchSection() {
  const { t } = useTranslation();
  const { session, user } = useAuth();
  const { currentFestival } = useFestival();
  const toast = useToast();
  const watchState = useWatchState();
  const [isPinging, setIsPinging] = useState(false);

  const handleSyncNow = useCallback(() => {
    if (!session?.access_token || !session.refresh_token || !user?.id) return;
    forceSyncSessionToWatch({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: user.id,
      currentFestivalId: currentFestival?.id ?? null,
      expiresAt: session.expires_at ?? 0,
    });
    toast.show({
      placement: "top",
      render: () => (
        <HStack className="items-center gap-2 rounded-lg bg-success-500 px-4 py-3">
          <Check size={18} color={Colors.white} />
          <Text className="font-medium text-white">{t("profile.appleWatch.syncSuccess")}</Text>
        </HStack>
      ),
    });
  }, [session, user, currentFestival, toast, t]);

  const handlePing = useCallback(async () => {
    setIsPinging(true);
    const result = await pingWatch();
    setIsPinging(false);

    const success = result === "pong";
    const messageKey =
      result === "pong"
        ? "profile.appleWatch.testResult.pong"
        : result === "timeout"
          ? "profile.appleWatch.testResult.timeout"
          : "profile.appleWatch.testResult.noStorage";

    toast.show({
      placement: "top",
      render: () => (
        <HStack
          className={
            success
              ? "items-center gap-2 rounded-lg bg-success-500 px-4 py-3"
              : "items-center gap-2 rounded-lg bg-error-500 px-4 py-3"
          }
        >
          {success ? (
            <Check size={18} color={Colors.white} />
          ) : (
            <X size={18} color={Colors.white} />
          )}
          <Text className="font-medium text-white">{t(messageKey)}</Text>
        </HStack>
      ),
    });
  }, [toast, t]);

  if (Platform.OS !== "ios") return null;
  if (watchState === null) return null;

  const { isPaired, isWatchAppInstalled, isReachable } = watchState;

  return (
    <Card size="md" variant="elevated">
      <HStack className="mb-2 items-center gap-2">
        <Watch size={20} color={IconColors.default} />
        <Text className="text-lg font-semibold text-typography-900">
          {t("profile.appleWatch.title")}
        </Text>
      </HStack>
      <Text className="mb-3 text-sm text-typography-600">
        {t("profile.appleWatch.description")}
      </Text>

      {!isPaired ? (
        <Text className="text-sm text-typography-500">{t("profile.appleWatch.notPaired")}</Text>
      ) : !isWatchAppInstalled ? (
        <VStack space="xs">
          <Text className="text-sm text-typography-900">
            {t("profile.appleWatch.notInstalled")}
          </Text>
          <Text className="text-xs text-typography-500">
            {t("profile.appleWatch.notInstalledHint")}
          </Text>
        </VStack>
      ) : (
        <VStack space="md">
          <HStack className="flex-wrap gap-2">
            <StatusPill label={t("profile.appleWatch.status.paired")} active={isPaired} />
            <StatusPill
              label={t("profile.appleWatch.status.installed")}
              active={isWatchAppInstalled}
            />
            <StatusPill
              label={
                isReachable
                  ? t("profile.appleWatch.status.reachable")
                  : t("profile.appleWatch.status.notReachable")
              }
              active={isReachable}
            />
          </HStack>

          <Button
            variant="outline"
            action="secondary"
            onPress={handleSyncNow}
            accessibilityLabel={t("profile.appleWatch.syncNowA11yLabel")}
            accessibilityHint={t("profile.appleWatch.syncNowA11yHint")}
          >
            <RefreshCw size={18} color={IconColors.default} />
            <ButtonText>{t("profile.appleWatch.syncNow")}</ButtonText>
          </Button>

          <View>
            <Button
              variant="outline"
              action="secondary"
              onPress={handlePing}
              disabled={!isReachable || isPinging}
              accessibilityLabel={t("profile.appleWatch.testConnectionA11yLabel")}
              accessibilityHint={t("profile.appleWatch.testConnectionA11yHint")}
            >
              {isPinging ? (
                <ButtonSpinner color={IconColors.default} />
              ) : (
                <Radio size={18} color={IconColors.default} />
              )}
              <ButtonText>
                {isPinging
                  ? t("profile.appleWatch.testing")
                  : t("profile.appleWatch.testConnection")}
              </ButtonText>
            </Button>
            {!isReachable ? (
              <Text className="mt-1 text-xs text-typography-500">
                {t("profile.appleWatch.testDisabledWhenUnreachable")}
              </Text>
            ) : null}
          </View>
        </VStack>
      )}
    </Card>
  );
}
