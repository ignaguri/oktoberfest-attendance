"use client";

import QRCode from "@/components/QR/QRCode";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useShare } from "@/hooks/use-share";
import { Share2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { renewGroupToken } from "./actions";

interface ShareButtonProps {
  groupName: string;
  groupId: string;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function ShareButton({
  groupName,
  groupId,
  withText = false,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [groupLink, setGroupLink] = useState("");
  const [tokenGenerated, setTokenGenerated] = useState(false);

  const { shareViaNative, isWebShareSupported, shareViaWhatsApp } = useShare({
    title: `Join ${groupName} on ProstCounter`,
    text: `Join my group "${groupName}" on the ProstCounter app!\nClick here to join: ${groupLink}`,
    url: groupLink,
  });

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const generateShareLink = useCallback(async () => {
    try {
      const token = await renewGroupToken(groupId);
      const newGroupLink = `${APP_URL}/api/join-group?token=${token}`;
      setGroupLink(newGroupLink);
    } catch {
      toast.error("Error", {
        description: "Failed to generate share link. Please try again.",
      });
    }
  }, [groupId, APP_URL]);

  const handleShareClick = async () => {
    if (!tokenGenerated) {
      await generateShareLink();
      setTokenGenerated(true);
    }

    if (isWebShareSupported && groupLink) {
      // Direct native sharing - no dialog needed
      await shareViaNative();
    } else {
      // Fallback to dialog for unsupported browsers
      setOpen(true);
    }
  };

  useEffect(() => {
    if (open && !tokenGenerated) {
      generateShareLink();
      setTokenGenerated(true); // Set to true after generating the token
    }
  }, [generateShareLink, open, tokenGenerated]);

  const title = "Invite to join";
  const description = "Choose how you'd like to share the group information:";

  const ButtonsGroup = () => (
    <div className="flex flex-col gap-4 items-center p-6">
      {groupLink && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Scan QR code to join:</p>
          <QRCode value={groupLink} size={180} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="yellow" onClick={shareViaNative}>
          {isWebShareSupported ? "Share Invite" : "Copy Invite Link"}
        </Button>
        <Button variant="darkYellow" onClick={shareViaWhatsApp}>
          Share via WhatsApp
        </Button>
      </div>
    </div>
  );

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
        <ButtonsGroup />
      </ResponsiveDialog>
    </>
  );
}
