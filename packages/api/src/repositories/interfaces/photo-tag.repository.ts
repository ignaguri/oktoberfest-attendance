import type { PhotoTaggedUser } from "@prostcounter/shared";

export interface PhotoTagTarget {
  photoId: string;
  uploaderId: string;
  visibility: "public" | "private";
  festivalId: string;
}

export interface TaggedPhotoRow {
  id: string;
  pictureUrl: string;
  createdAt: string;
  uploaderId: string;
}

/**
 * Photo tags, read and written with the caller's client so RLS applies:
 * a photo the caller cannot see behaves as missing.
 */
export interface IPhotoTagRepository {
  getPhotoTarget(photoId: string): Promise<PhotoTagTarget | null>;
  listTaggedUserIds(photoId: string): Promise<string[]>;
  addTags(photoId: string, userIds: string[]): Promise<void>;
  removeTags(photoId: string, userIds: string[]): Promise<void>;
  getTaggedUsers(photoId: string): Promise<PhotoTaggedUser[]>;
  listTaggedPhotos(userId: string, festivalId: string, limit: number): Promise<TaggedPhotoRow[]>;
  getProfiles(userIds: string[]): Promise<PhotoTaggedUser[]>;
  /** For each user id, a group of the viewer's in this festival that also has that user. */
  findSharedGroupIds(
    viewerId: string,
    userIds: string[],
    festivalId: string,
  ): Promise<Map<string, string>>;
}
