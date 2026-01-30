"use client";

import { Share2 } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { useState } from "react";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useShare } from "@/hooks/use-share";
import { useTranslation } from "@/lib/i18n/client";

const ICON_SIZE = 20;

export default function ShareAppButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    showQRCode,
    isWebShareSupported,
    shareViaWhatsApp,
    shareViaNative,
    toggleQRCode,
  } = useShare({
    title: "ProstCounter App",
    text: t("home.shareAppDialog.shareText"),
  });

  const title = t("home.shareAppDialog.title");
  const description = t("home.shareAppDialog.description");

  const ButtonsGroup = useMemo(
    () => (
      <div className="flex flex-col items-center gap-2 p-8">
        <Button variant="yellow" onClick={shareViaNative}>
          {isWebShareSupported
            ? t("home.shareAppDialog.shareButton")
            : t("home.shareAppDialog.copyToClipboard")}
        </Button>
        {!isWebShareSupported && (
          <Button variant="yellow" onClick={shareViaWhatsApp}>
            {t("home.shareAppDialog.shareViaWhatsApp")}
          </Button>
        )}
        <Button variant="secondary" onClick={toggleQRCode}>
          {showQRCode
            ? t("home.shareAppDialog.hideQRCode")
            : t("home.shareAppDialog.showQRCode")}
        </Button>
        {showQRCode && (
          <div className="mt-4">
            <Image
              src="/images/qrcode.svg"
              alt={t("home.shareAppDialog.qrCodeAlt")}
              className="object-fill"
              width={270}
              height={270}
            />
          </div>
        )}
      </div>
    ),
    [
      shareViaNative,
      shareViaWhatsApp,
      toggleQRCode,
      isWebShareSupported,
      showQRCode,
      t,
    ],
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={
        <Button variant="yellowOutline" className="flex items-center">
          <Share2 size={ICON_SIZE} />
          <span className="ml-2">{t("home.shareApp")}</span>
        </Button>
      }
      className="sm:max-w-[425px]"
    >
      {ButtonsGroup}
    </ResponsiveDialog>
  );
}
