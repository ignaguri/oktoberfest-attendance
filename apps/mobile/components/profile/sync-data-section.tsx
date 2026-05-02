import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback } from "react";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useResyncFromServer } from "@/hooks/useResyncFromServer";
import { Colors } from "@/lib/constants/colors";
import { useIsOnline } from "@/lib/database/offline-provider";
import { logger } from "@/lib/logger";

export function SyncDataSection() {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const { currentFestival } = useFestival();
  const { resync, isResyncing } = useResyncFromServer();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const hasFestival = Boolean(currentFestival?.id);

  const runResync = useCallback(async () => {
    try {
      await resync();
      showDialog(t("common.status.success"), t("profile.syncData.success"));
    } catch (error) {
      logger.error("[SyncData] Resync failed:", error);
      showDialog(t("common.status.error"), t("common.errors.generic"));
    }
  }, [resync, showDialog, t]);

  const handlePress = useCallback(() => {
    if (isResyncing) return;
    if (!isOnline) {
      showDialog(t("common.status.error"), t("common.errors.offline.message"));
      return;
    }
    if (!hasFestival) {
      showDialog(t("common.status.error"), t("profile.syncData.errorNoFestival"));
      return;
    }
    showDialog(
      t("profile.syncData.confirmTitle"),
      t("profile.syncData.confirmMessage"),
      "destructive",
      runResync,
    );
  }, [hasFestival, isOnline, isResyncing, runResync, showDialog, t]);

  return (
    <>
      <Card size="sm" variant="outline" className="border-yellow-200 bg-yellow-50">
        <VStack space="sm" className="items-center">
          <Text className="text-center text-xs text-yellow-700">
            {t("profile.syncData.helper")}
          </Text>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            onPress={handlePress}
            disabled={isResyncing || !hasFestival}
            className="border-yellow-400"
            accessibilityLabel={t("profile.syncData.button")}
            accessibilityHint={t("profile.syncData.helper")}
          >
            {isResyncing ? (
              <>
                <ButtonSpinner color={Colors.primary[600]} />
                <ButtonText className="text-yellow-700">{t("profile.syncData.syncing")}</ButtonText>
              </>
            ) : (
              <ButtonText className="text-yellow-700">{t("profile.syncData.button")}</ButtonText>
            )}
          </Button>
        </VStack>
      </Card>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
