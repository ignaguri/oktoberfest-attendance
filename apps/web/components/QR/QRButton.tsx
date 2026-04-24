"use client";

import { buildGroupInviteUrl } from "@prostcounter/shared";
import { QrCode, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useRenewInviteToken } from "@/hooks/useGroups";
import { useTranslation } from "@/lib/i18n/client";

import QRCode from "./QRCode";

interface QRButtonProps {
  groupName: string;
  groupId: string;
  inviteToken: string | null;
  isCreator: boolean;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function QRButton({
  groupName,
  groupId,
  inviteToken,
  isCreator,
  withText = false,
}: QRButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: renewToken, loading: isRegenerating } =
    useRenewInviteToken();

  const groupLink = useMemo(() => {
    if (!inviteToken) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    return buildGroupInviteUrl(inviteToken, origin);
  }, [inviteToken]);

  const handleRegenerate = async () => {
    try {
      await renewToken({ groupId });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("groups.qrCode.regenerateError"),
      });
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center"
        onClick={() => setOpen(true)}
      >
        <QrCode size={ICON_SIZE} />
        {withText && <span className="ml-2">{t("groups.qrCode.title")}</span>}
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t("groups.qrCode.title")}
        description={t("groups.qrCode.description", { name: groupName })}
        className="sm:max-w-[425px]"
      >
        <div className="flex flex-col items-center gap-4 p-6">
          {groupLink ? (
            <>
              <QRCode value={groupLink} size={220} />
              <p className="text-muted-foreground text-center text-sm">
                {t("groups.qrCode.helper")}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              {isCreator
                ? t("groups.qrCode.noTokenCreator")
                : t("groups.qrCode.noTokenMember")}
            </p>
          )}

          {isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw size={16} className="mr-2" />
              {groupLink
                ? t("groups.qrCode.regenerate")
                : t("groups.qrCode.generate")}
            </Button>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
