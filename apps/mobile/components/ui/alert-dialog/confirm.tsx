import { useTranslation } from "@prostcounter/shared/i18n";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

import type { AlertDialogState } from "./index";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "./index";

interface ConfirmAlertDialogProps {
  dialog: AlertDialogState;
  onClose: () => void;
}

export function ConfirmAlertDialog({
  dialog,
  onClose,
}: ConfirmAlertDialogProps) {
  const { t } = useTranslation();
  const isDestructive = dialog.type === "destructive";

  return (
    <AlertDialog isOpen={dialog.isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogHeader>
          <Heading
            size="lg"
            className={isDestructive ? "text-error-600" : "text-typography-950"}
          >
            {dialog.title}
          </Heading>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-4 mt-3">
          <Text size="sm" className="text-typography-500">
            {dialog.message}
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter className="gap-3">
          {dialog.onConfirm ? (
            <>
              <Button
                variant="outline"
                action="secondary"
                onPress={onClose}
                className="flex-1"
              >
                <ButtonText>{t("common.buttons.cancel")}</ButtonText>
              </Button>
              <Button
                action={isDestructive ? "negative" : "primary"}
                onPress={() => {
                  dialog.onConfirm?.();
                  onClose();
                }}
                className="flex-1"
              >
                <ButtonText>
                  {isDestructive
                    ? t("common.buttons.confirm")
                    : t("common.buttons.ok")}
                </ButtonText>
              </Button>
            </>
          ) : (
            <Button action="primary" onPress={onClose} className="flex-1">
              <ButtonText>{t("common.buttons.ok")}</ButtonText>
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
