"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

const ICON_SIZE = 20;

export default function ShareAppButton() {
  const [open, setOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy share text");
  const [showQRCode, setShowQRCode] = useState(false);
  const { toast } = useToast();

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const shareText = `Check out the ProstCounter app! Track your Oktoberfest attendance and compete with friends. Click here to join: ${APP_URL}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyButtonText("Copied!");
      setTimeout(() => {
        setCopyButtonText("Copy share text");
      }, 3000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy text to clipboard.",
      });
    }
  };

  const title = "Share ProstCounter App with friends!";
  const description = "Choose how you’d like to share the app:";

  const ButtonsGroup = () => (
    <div className="flex flex-col gap-2 items-center p-8">
      <Button
        variant="yellow"
        onClick={() =>
          window.open(
            `https://wa.me/?text=${encodeURIComponent(shareText)}`,
            "_blank",
          )
        }
      >
        Share via WhatsApp
      </Button>
      <Button variant="yellowOutline" onClick={copyToClipboard}>
        {copyButtonText}
      </Button>
      <Button variant="secondary" onClick={() => setShowQRCode(!showQRCode)}>
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
