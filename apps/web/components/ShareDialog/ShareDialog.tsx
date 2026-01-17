"use client";

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
  title = "Share ProstCounter App with friends!",
  description = "Choose how you'd like to share the app:",
  className,
}: ShareDialogProps) {
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 p-8">
          <Button
            variant="yellow"
            onClick={shareViaWhatsApp}
            className="w-full"
          >
            Share via WhatsApp
          </Button>

          <Button
            variant="yellowOutline"
            onClick={copyToClipboard}
            className="w-full"
          >
            {copyButtonText}
          </Button>

          <Button variant="secondary" onClick={toggleQRCode} className="w-full">
            {showQRCode ? "Hide QR Code" : "Show QR Code"}
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
