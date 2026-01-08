"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { use } from "react";

import { GalleryGrid } from "./GalleryGrid";

interface GalleryPageProps {
  params: Promise<{ id: string }>;
}

export default function GalleryPage({ params }: GalleryPageProps) {
  const { id: groupId } = use(params);

  const { data: galleryResponse, loading } = useQuery(
    ["group", groupId, "gallery"],
    () => apiClient.groups.getGallery(groupId),
    { enabled: !!groupId },
  );

  if (loading) {
    return (
      <div className="container mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-2xl font-bold">Group Gallery</h1>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <LoadingSpinner />
          <span className="text-sm text-gray-500">Loading gallery...</span>
        </div>
      </div>
    );
  }

  // Transform flat API response to grouped format expected by GalleryGrid
  const galleryData = transformToGalleryData(galleryResponse?.data || []);

  return (
    <div className="container mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Group Gallery</h1>
      <GalleryGrid galleryData={galleryData} />
    </div>
  );
}

// Transform flat gallery data to grouped by date and username
function transformToGalleryData(
  data: Array<{
    id: string;
    userId: string;
    username: string;
    fullName: string | null;
    pictureUrl: string;
    date: string;
    createdAt: string;
  }>,
) {
  const result: Record<
    string,
    Record<
      string,
      Array<{
        id: string;
        url: string;
        uploadedAt: string;
        userId: string;
        username: string;
      }>
    >
  > = {};

  for (const item of data) {
    const dateKey = new Date(item.date).toDateString();
    const username = item.username || item.fullName || "Unknown User";

    if (!result[dateKey]) {
      result[dateKey] = {};
    }
    if (!result[dateKey][username]) {
      result[dateKey][username] = [];
    }

    result[dateKey][username].push({
      id: item.id,
      url: item.pictureUrl,
      uploadedAt: item.createdAt,
      userId: item.userId,
      username,
    });
  }

  return result;
}
