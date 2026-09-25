export interface PhotoGalleryTarget {
  photoId: string;
  groupId: string;
}

/**
 * Where a tapped feed photo should open. Reactions and comments live on a
 * group, so the gallery viewer needs a group the viewer shares with the
 * uploader; the feed view supplies one as `shared_group_id`. Without it (a
 * friend outside your groups, or an item from before the field existed) the
 * photo opens in the plain preview.
 */
export function getPhotoGalleryTarget(activityData: unknown): PhotoGalleryTarget | null {
  if (!activityData || typeof activityData !== "object") {
    return null;
  }
  const { picture_id: photoId, shared_group_id: groupId } = activityData as Record<string, unknown>;
  if (typeof photoId !== "string" || typeof groupId !== "string") {
    return null;
  }
  return { photoId, groupId };
}
