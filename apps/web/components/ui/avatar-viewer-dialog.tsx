"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import Image from "next/image";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/client";

interface AvatarViewerDialogProps {
  /** Whether the viewer is open */
  open: boolean;
  /** Callback when the viewer should close */
  onOpenChange: (open: boolean) => void;
  /** Fully resolved avatar URL, already passed through getAvatarUrl */
  imageUrl: string;
  /** Name used as the image's alt text */
  name: string;
}

/** Full-screen viewer for a profile picture. */
export function AvatarViewerDialog({
  open,
  onOpenChange,
  imageUrl,
  name,
}: AvatarViewerDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden border-none bg-black/95 p-0 sm:max-w-[90vw]"
        showCloseButton={false}
      >
        <VisuallyHidden asChild>
          <DialogTitle>{t("profile.avatar.fullSizeTitle")}</DialogTitle>
        </VisuallyHidden>

        <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-white/90 p-2 transition-colors hover:bg-white">
          <X className="size-5 text-black" />
          <span className="sr-only">{t("profile.avatar.fullSizeClose")}</span>
        </DialogClose>

        <div className="relative h-[80vh] w-full">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-contain"
            priority
            sizes="90vw"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
