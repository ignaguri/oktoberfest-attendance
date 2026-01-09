"use client";

import { cn } from "@/lib/utils";
import { IMAGE_PLACEHOLDER_BASE64 } from "@prostcounter/shared/constants";
import Image from "next/image";
import { useState } from "react";

import { Dialog, DialogContent, DialogOverlay } from "./dialog";

interface PhotoPreviewProps {
  urls: string[];
  bucket?: string;
  maxThumbnails?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PhotoPreview({
  urls,
  bucket = "beer_pictures",
  maxThumbnails = 3,
  size = "md",
  className = "",
}: PhotoPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!urls || urls.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const thumbnailSize = sizeClasses[size];

  const displayUrls = urls.slice(0, maxThumbnails);
  const remainingCount = urls.length - maxThumbnails;

  return (
    <>
      <div className={cn("flex items-center gap-1", className)}>
        {displayUrls.map((url, index) => (
          <div
            key={index}
            className={cn(
              "relative cursor-pointer overflow-hidden rounded border border-gray-200 transition-colors hover:border-yellow-400",
              thumbnailSize,
            )}
            onClick={() => setSelectedImage(url)}
          >
            <Image
              src={`/api/image/${url}?bucket=${bucket}`}
              alt="Photo preview"
              fill
              className="transform-gpu object-cover will-change-transform"
              sizes={size === "sm" ? "32px" : size === "md" ? "48px" : "64px"}
              loading="lazy"
              placeholder="blur"
              blurDataURL={IMAGE_PLACEHOLDER_BASE64}
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs font-medium text-gray-600",
              thumbnailSize,
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogOverlay />
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          {selectedImage && (
            <div className="relative h-full w-full">
              <Image
                src={`/api/image/${selectedImage}?bucket=${bucket}`}
                alt="Full size photo"
                width={1200}
                height={800}
                className="h-full w-full object-contain"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
