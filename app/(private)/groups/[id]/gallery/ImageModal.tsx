"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Image from "next/image";

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="min-w-[50vw] min-h-[50vh] sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden">
        <VisuallyHidden asChild>
          <DialogTitle>Full size image</DialogTitle>
        </VisuallyHidden>
        <div className="relative w-full h-full">
          <Image
            src={imageUrl}
            alt="Full size image"
            layout="fill"
            objectFit="contain"
            priority
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 90vw"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
