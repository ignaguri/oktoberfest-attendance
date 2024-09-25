import LoadingSpinner from "@/components/LoadingSpinner";
import { fetchGroupGallery } from "@/lib/actions";
import { Suspense } from "react";

import { GalleryGrid } from "./GalleryGrid";

interface GalleryPageProps {
  params: { id: string };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const groupId = params.id;
  const galleryData = await fetchGroupGallery(groupId);

  return (
    <div className="max-w-xl container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Group Gallery</h1>
      <Suspense
        fallback={
          <div className="flex flex-col justify-center items-center h-full gap-4">
            <LoadingSpinner />
            <span className="text-sm text-gray-500">Loading gallery...</span>
          </div>
        }
      >
        <GalleryGrid galleryData={galleryData} />
      </Suspense>
    </div>
  );
}
