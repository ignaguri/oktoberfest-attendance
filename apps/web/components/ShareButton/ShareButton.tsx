"use client";

import { buildGroupInviteUrl } from "@prostcounter/shared";
import { RefreshCw, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import QRCode from "@/components/QR/QRCode";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useShare } from "@/hooks/use-share";
import { useRenewInviteToken } from "@/hooks/useGroups";
import { useTranslation } from "@/lib/i18n/client";

interface ShareButtonProps {
  groupName: string;
  groupId: string;
  inviteToken: string | null;
  isCreator: boolean;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function ShareButton({
  groupName,
  groupId,
  inviteToken,
  isCreator,
  withText = false,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const groupLink = useMemo(() => {
    if (!inviteToken) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    return buildGroupInviteUrl(inviteToken, origin);
  }, [inviteToken]);

  const { shareViaNative, isWebShareSupported, shareViaWhatsApp } = useShare({
    title: `Join ${groupName} on ProstCounter`,
    text: `Join my group "${groupName}" on the ProstCounter app!\nClick here to join: ${groupLink}`,
    url: groupLink,
  });

  const { mutateAsync: renewToken, loading: isRegenerating } =
    useRenewInviteToken();

  const handleShareClick = async () => {
    if (!groupLink) {
      setOpen(true);
      return;
    }

    if (isWebShareSupported) {
      await shareViaNative();
    } else {
      setOpen(true);
    }
  };

  const handleRegenerate = async () => {
    try {
      await renewToken({ groupId });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("groups.qrCode.regenerateError"),
      });
    }
  };

  const title = "Invite to join";
  const description = "Choose how you'd like to share the group information:";

  return (
    <>
      <Button
        variant="yellow"
        className="flex items-center"
        onClick={handleShareClick}
      >
        <Share2 size={ICON_SIZE} />
        {withText && <span className="ml-2">{title}</span>}
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        className="sm:max-w-[425px]"
      >
        <div className="flex flex-col items-center gap-4 p-6">
          {groupLink ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <p className="text-muted-foreground text-sm">
                  Scan QR code to join:
                </p>
                <QRCode value={groupLink} size={180} />
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="yellow" onClick={shareViaNative}>
                  {isWebShareSupported ? "Share Invite" : "Copy Invite Link"}
                </Button>
                <Button variant="darkYellow" onClick={shareViaWhatsApp}>
                  Share via WhatsApp
                </Button>
              </div>
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
