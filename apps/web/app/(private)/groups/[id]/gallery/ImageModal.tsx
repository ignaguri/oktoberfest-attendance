"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="min-h-[50vh] min-w-[50vw] overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-[90vw]">
        <VisuallyHidden asChild>
          <DialogTitle>Full size image</DialogTitle>
        </VisuallyHidden>
        <div className="relative h-full w-full">
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
