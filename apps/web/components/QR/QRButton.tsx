"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { QrCode } from "lucide-react";
import { useState, useEffect, useCallback, startTransition } from "react";
import { toast } from "sonner";

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

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const generateShareLink = useCallback(async () => {
    try {
      const { inviteToken } = await apiClient.groups.renewToken(groupId);
      const newGroupLink = `${APP_URL}/api/join-group?token=${inviteToken}`;
      startTransition(() => {
        setGroupLink(newGroupLink);
      });
    } catch {
      toast.error("Error", {
        description: "Failed to generate QR code. Please try again.",
      });
    }
  }, [groupId, APP_URL]);

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
        <div className="flex flex-col gap-4 items-center p-6">
          {groupLink && (
            <>
              <QRCode value={groupLink} size={220} />
              <p className="text-sm text-muted-foreground text-center">
                Others can scan this code to join your group instantly!
              </p>
            </>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
