"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import QRCode from "./QRCode";
import { renewGroupToken } from "../ShareButton/actions";

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
  const { toast } = useToast();

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const generateShareLink = useCallback(async () => {
    try {
      const token = await renewGroupToken(groupId);
      const newGroupLink = `${APP_URL}/api/join-group?token=${token}`;
      setGroupLink(newGroupLink);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
      });
    }
  }, [groupId, APP_URL, toast]);

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
      setTokenGenerated(true);
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
