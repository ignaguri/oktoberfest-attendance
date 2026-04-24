"use client";

import { buildGroupInviteUrl } from "@prostcounter/shared";
import { QrCode, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useRenewInviteToken } from "@/hooks/useGroups";

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
      toast.error("Error", {
        description: "Failed to regenerate invite token. Please try again.",
      });
    }
  };

  const title = "QR Code to Join";
  const description = `Scan this QR code to join "${groupName}"`;

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center"
        onClick={() => setOpen(true)}
      >
        <QrCode size={ICON_SIZE} />
        {withText && <span className="ml-2">QR Code</span>}
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
              <QRCode value={groupLink} size={220} />
              <p className="text-muted-foreground text-center text-sm">
                Others can scan this code to join your group instantly!
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              No invite link yet.
              {isCreator
                ? " Generate one with the button below."
                : " Ask the group creator to generate one."}
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
              {groupLink ? "Regenerate" : "Generate"}
            </Button>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
