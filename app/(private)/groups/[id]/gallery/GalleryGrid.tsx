"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Camera } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { GalleryData } from "@/lib/types";

import { ImageModal } from "./ImageModal";

interface GalleryGridProps {
  galleryData: GalleryData;
}

export function GalleryGrid({ galleryData }: GalleryGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Check if there are any photos
  const hasPhotos = Object.values(galleryData).some((userImages) =>
    Object.values(userImages).some((images) => images.length > 0),
  );

  if (!hasPhotos) {
    return (
      <EmptyState
        icon={Camera}
        title="No Photos Yet"
        description="Be the first to share photos from your festival adventures! Upload pictures when you register your attendance."
        actionLabel="Go to Attendance"
        onAction={() => (window.location.href = "/attendance")}
      />
    );
  }

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
                <h4 className="text-lg font-medium mb-3 cursor-pointer hover:text-yellow-600 transition-colors">
                  {images[0].username}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="relative aspect-square cursor-pointer group"
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
                        className="rounded-lg transition-transform group-hover:scale-105"
                        loading="lazy"
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 200px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
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
