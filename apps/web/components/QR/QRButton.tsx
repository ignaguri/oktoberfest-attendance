"use client";

import { buildGroupInviteUrl } from "@prostcounter/shared";
import { QrCode } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useRenewInviteToken } from "@/hooks/useGroups";

import QRCode from "./QRCode";

interface QRButtonProps {
  groupName: string;
  groupId: string;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function QRButton({
  groupName,
  groupId,
  withText = false,
}: QRButtonProps) {
  const [open, setOpen] = useState(false);
  const [groupLink, setGroupLink] = useState("");
  const [tokenGenerated, setTokenGenerated] = useState(false);

  const { mutateAsync: renewToken } = useRenewInviteToken();

  const generateShareLink = useCallback(async () => {
    try {
      const { inviteToken } = await renewToken({ groupId });
      // Pin the origin to the browser window so the link matches whatever host
      // the user is currently on (prod, preview, local). The shared helper
      // enforces the "/join-group" path that the mobile intent filter expects.
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const newGroupLink = buildGroupInviteUrl(inviteToken, origin);
      startTransition(() => {
        setGroupLink(newGroupLink);
      });
    } catch {
      toast.error("Error", {
        description: "Failed to generate QR code. Please try again.",
      });
    }
  }, [groupId, renewToken]);

  const handleQRClick = async () => {
    if (!tokenGenerated) {
      await generateShareLink();
      setTokenGenerated(true);
    }
    setOpen(true);
  };

  useEffect(() => {
    if (open && !tokenGenerated) {
      generateShareLink();
      startTransition(() => {
        setTokenGenerated(true);
      });
    }
  }, [generateShareLink, open, tokenGenerated]);

  const title = "QR Code to Join";
  const description = `Scan this QR code to join "${groupName}"`;

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center"
        onClick={handleQRClick}
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
          {groupLink && (
            <>
              <QRCode value={groupLink} size={220} />
              <p className="text-muted-foreground text-center text-sm">
                Others can scan this code to join your group instantly!
              </p>
            </>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
