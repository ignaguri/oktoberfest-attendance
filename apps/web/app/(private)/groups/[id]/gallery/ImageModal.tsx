"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import Image from "next/image";

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent
        className="flex min-h-[50vh] min-w-[50vw] items-center justify-center overflow-hidden border-none bg-black/95 p-0 sm:max-h-[90vh] sm:max-w-[90vw]"
        showCloseButton={false}
      >
        <VisuallyHidden asChild>
          <DialogTitle>Full size image</DialogTitle>
        </VisuallyHidden>

        {/* Custom close button with high visibility */}
        <DialogClose className="absolute right-4 top-4 z-50 rounded-full bg-white/90 p-2 transition-colors hover:bg-white">
          <X className="size-5 text-black" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="relative h-[80vh] w-full">
          <Image
            src={imageUrl}
            alt="Full size image"
            fill
            className="object-contain"
            priority
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 90vw"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
