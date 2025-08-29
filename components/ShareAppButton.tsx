"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useShare } from "@/hooks/use-share";
import { Share2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const ICON_SIZE = 20;

export default function ShareAppButton() {
  const [open, setOpen] = useState(false);
  const {
    showQRCode,
    isWebShareSupported,
    shareViaWhatsApp,
    shareViaNative,
    toggleQRCode,
  } = useShare({
    title: "ProstCounter App",
    text: "Check out the ProstCounter app! Track your Oktoberfest attendance and compete with friends.",
  });

  const title = "Share ProstCounter App with friends!";
  const description = "Choose how you'd like to share the app:";

  const ButtonsGroup = () => (
    <div className="flex flex-col gap-2 items-center p-8">
      <Button variant="yellow" onClick={shareViaNative}>
        {isWebShareSupported ? "Share App" : "Copy to Clipboard"}
      </Button>
      {!isWebShareSupported && (
        <Button variant="yellow" onClick={shareViaWhatsApp}>
          Share via WhatsApp
        </Button>
      )}
      <Button variant="secondary" onClick={toggleQRCode}>
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
          <span className="ml-2">Share this app</span>
        </Button>
      }
      className="sm:max-w-[425px]"
    >
      <ButtonsGroup />
    </ResponsiveDialog>
  );
}
