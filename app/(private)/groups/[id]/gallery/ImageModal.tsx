"use client";

import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="min-w-[50vw] min-h-[50vh] sm:max-w-[90vw] sm:max-h-[90vh]">
        <VisuallyHidden asChild>
          <DialogTitle>Full size image</DialogTitle>
        </VisuallyHidden>
        <div className="relative w-full h-full">
          <Image
            src={imageUrl}
            alt="Full size image"
            layout="fill"
            objectFit="contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
