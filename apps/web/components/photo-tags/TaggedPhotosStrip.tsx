"use client";

import { useTaggedPhotos } from "@prostcounter/shared/hooks";
import type { TaggedPhoto } from "@prostcounter/shared/schemas";
import Image from "next/image";
import { useState } from "react";

import { ImageModal } from "@/app/[lang]/(private)/groups/[id]/gallery/ImageModal";
import { useTranslation } from "@/lib/i18n/client";
import { getBeerPictureUrl } from "@/lib/utils";

interface TaggedPhotosStripProps {
  userId: string | undefined;
  festivalId: string | undefined;
  title: string;
}

/** Photos someone is tagged in for the current festival. Renders nothing when empty. */
export function TaggedPhotosStrip({ userId, festivalId, title }: TaggedPhotosStripProps) {
  const { t } = useTranslation();
  const { data } = useTaggedPhotos(userId, festivalId);
  const [openPhoto, setOpenPhoto] = useState<TaggedPhoto | null>(null);

  const photos = data?.photos ?? [];
  if (photos.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenPhoto(photo)}
            aria-label={t("photoTags.strip.openPhotoHint")}
            className="relative size-20 shrink-0 overflow-hidden rounded-lg"
          >
            <Image
              src={getBeerPictureUrl(photo.pictureUrl) ?? ""}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          </button>
        ))}
      </div>
      <ImageModal
        imageUrl={openPhoto ? (getBeerPictureUrl(openPhoto.pictureUrl) ?? null) : null}
        photoId={openPhoto?.id ?? null}
        groupId={openPhoto?.groupId ?? undefined}
        onClose={() => setOpenPhoto(null)}
      />
    </section>
  );
}
