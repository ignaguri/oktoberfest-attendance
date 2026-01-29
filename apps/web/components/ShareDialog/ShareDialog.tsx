"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShare } from "@/hooks/use-share";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const {
    copyButtonText,
    showQRCode,
    copyToClipboard,
    shareViaWhatsApp,
    toggleQRCode,
  } = useShare();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className || "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle>
            {title ||
              t("home.shareApp", {
                defaultValue: "Share ProstCounter App with friends!",
              })}
          </DialogTitle>
          <DialogDescription>
            {description ||
              t("groups.share.title", {
                defaultValue: "Choose how you'd like to share the app:",
              })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 p-8">
          <Button
            variant="yellow"
            onClick={shareViaWhatsApp}
            className="w-full"
          >
            {t("groups.share.shareLink", {
              defaultValue: "Share via WhatsApp",
            })}
          </Button>

          <Button
            variant="yellowOutline"
            onClick={copyToClipboard}
            className="w-full"
          >
            {copyButtonText}
          </Button>

          <Button variant="secondary" onClick={toggleQRCode} className="w-full">
            {showQRCode
              ? t("common.buttons.close", { defaultValue: "Hide QR Code" })
              : t("groups.qrCode.title", { defaultValue: "Show QR Code" })}
          </Button>

          {showQRCode && (
            <div className="mt-4">
              <Image
                src="/images/qrcode.svg"
                alt="QR Code"
                className="object-fill"
                width={270}
                height={270}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
