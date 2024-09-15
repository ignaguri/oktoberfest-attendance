"use client";

import { useState } from "react";
import useMediaQuery from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  groupName: string;
  groupId: string;
  groupPassword: string;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function ShareButton({
  groupName,
  groupId,
  groupPassword,
  withText = false,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy Invite Text");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  const groupLink = `${APP_URL}/groups/${groupId}`;
  const shareText = `Join my group "${groupName}" on the ProstCounter app!\nGroup password: ${groupPassword}.\nClick here to join: ${groupLink}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyButtonText("Copied!");
      setTimeout(() => {
        setCopyButtonText("Copy Invite Text");
      }, 3000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="yellow">
            <Share2 size={ICON_SIZE} />
            {withText && <span className="ml-2">Share group</span>}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Share Group</DialogTitle>
            <DialogDescription>
              Choose how you’d like to share the group information:
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2 items-center">
            <Button variant="yellowOutline" onClick={copyToClipboard}>
              {copyButtonText}
            </Button>
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="yellow" className="flex items-center">
          <Share2 size={ICON_SIZE} />
          {withText && <span className="ml-2">Share group</span>}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Share Group</DrawerTitle>
          <DrawerDescription>
            Choose how you’d like to share the group information:
          </DrawerDescription>
        </DrawerHeader>
        <div className="mt-4 flex flex-col gap-2 items-center">
          <Button variant="yellowOutline" onClick={copyToClipboard}>
            {copyButtonText}
          </Button>
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
        </div>
        <DrawerFooter className="pt-2"></DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
