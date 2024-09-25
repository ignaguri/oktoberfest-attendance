"use client";

import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import Image from "next/image";
import { useState } from "react";

import type { GalleryData } from "@/lib/types";

import { ImageModal } from "./ImageModal";

interface GalleryGridProps {
  galleryData: GalleryData;
}

export function GalleryGrid({ galleryData }: GalleryGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-8">
        {Object.entries(galleryData).map(([date, userImages]) => (
          <div key={date} className="mb-8">
            <h3 className="text-xl font-semibold mb-2">
              {format(new TZDate(date, TIMEZONE), "dd/MM/yyyy")}
            </h3>
            {Object.entries(userImages).map(([userId, images]) => (
              <div key={userId} className="mb-6">
                <h4 className="text-lg font-medium mb-3">
                  {images[0].username}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="relative aspect-square cursor-pointer"
                      onClick={() =>
                        setSelectedImage(
                          `/api/image/${image.url}?bucket=beer_pictures`,
                        )
                      }
                    >
                      <Image
                        src={`/api/image/${image.url}?bucket=beer_pictures`}
                        alt={`Uploaded by ${image.username}`}
                        layout="fill"
                        objectFit="cover"
                        className="rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </>
  );
}
