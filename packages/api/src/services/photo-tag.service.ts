import type { Database } from "@prostcounter/db";
import {
  type GetTaggedPhotosResponse,
  PHOTO_TAG_LIMIT,
  type PhotoTagsResponse,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";
import { NotFoundError, ValidationError } from "../middleware/error";
import type { IPhotoTagRepository, PhotoTagTarget } from "../repositories/interfaces";
import { SupabaseDayPlanRepository } from "../repositories/supabase/day-plan.repository";
import { SupabasePhotoTagRepository } from "../repositories/supabase/photo-tag.repository";
import { createNotificationService } from "./notification.service";

export const TAGGED_PHOTOS_LIMIT = 30;

export interface PhotoTagNotifier {
  notifyPhotoTag(input: {
    photoId: string;
    taggerId: string;
    festivalId: string;
    taggedUserIds: string[];
  }): Promise<void>;
}

/**
 * Who is in a photo. Only the uploader tags, only public photos, and only the
 * people they could say they are going with (friends and group-mates in the
 * photo's festival).
 */
export class PhotoTagService {
  constructor(
    private repo: IPhotoTagRepository,
    private listCompanionUserIds: (userId: string, festivalId: string) => Promise<string[]>,
    private notifier: PhotoTagNotifier | null,
  ) {}

  async setTags(photoId: string, callerId: string, userIds: string[]): Promise<PhotoTagsResponse> {
    const target = await this.repo.getPhotoTarget(photoId);

    if (!target || target.uploaderId !== callerId) {
      throw new NotFoundError(ErrorCodes.PHOTO_NOT_FOUND);
    }
    if (target.visibility !== "public") {
      throw new ValidationError(ErrorCodes.PHOTO_TAG_PRIVATE_PHOTO);
    }

    const requested = [...new Set(userIds)];

    if (requested.includes(callerId)) {
      throw new ValidationError(ErrorCodes.PHOTO_TAG_INVALID_USER);
    }
    if (requested.length > PHOTO_TAG_LIMIT) {
      throw new ValidationError(ErrorCodes.VALIDATION_ERROR);
    }
    if (requested.length > 0) {
      const allowed = new Set(await this.listCompanionUserIds(callerId, target.festivalId));
      if (requested.some((id) => !allowed.has(id))) {
        throw new ValidationError(ErrorCodes.PHOTO_TAG_INVALID_USER);
      }
    }

    const current = await this.repo.listTaggedUserIds(photoId);
    const added = requested.filter((id) => !current.includes(id));
    const removed = current.filter((id) => !requested.includes(id));

    if (removed.length > 0) {
      await this.repo.removeTags(photoId, removed);
    }
    if (added.length > 0) {
      await this.repo.addTags(photoId, added);
    }

    // Only the newly added hear about it, so editing tags never re-notifies
    if (added.length > 0 && this.notifier) {
      try {
        await this.notifier.notifyPhotoTag({
          photoId,
          taggerId: callerId,
          festivalId: target.festivalId,
          taggedUserIds: added,
        });
      } catch (notifyError) {
        logger.error({ error: notifyError, photoId }, "Failed to send photo tag notifications");
      }
    }

    return this.buildTagsResponse(target, true);
  }

  async getTags(photoId: string, callerId: string): Promise<PhotoTagsResponse> {
    const target = await this.repo.getPhotoTarget(photoId);

    if (!target) {
      throw new NotFoundError(ErrorCodes.PHOTO_NOT_FOUND);
    }

    return this.buildTagsResponse(
      target,
      target.uploaderId === callerId && target.visibility === "public",
    );
  }

  private async buildTagsResponse(
    target: PhotoTagTarget,
    canEdit: boolean,
  ): Promise<PhotoTagsResponse> {
    const [taggedUsers, [uploaderProfile]] = await Promise.all([
      this.repo.getTaggedUsers(target.photoId),
      this.repo.getProfiles([target.uploaderId]),
    ]);

    return {
      taggedUsers,
      canEdit,
      festivalId: target.festivalId,
      uploader: uploaderProfile ?? {
        userId: target.uploaderId,
        username: null,
        fullName: null,
        avatarUrl: null,
      },
    };
  }

  async getTaggedPhotos(
    viewerId: string,
    userId: string,
    festivalId: string,
  ): Promise<GetTaggedPhotosResponse> {
    const rows = await this.repo.listTaggedPhotos(userId, festivalId, TAGGED_PHOTOS_LIMIT);

    if (rows.length === 0) {
      return { photos: [] };
    }

    const uploaderIds = [...new Set(rows.map((row) => row.uploaderId))];
    const [profiles, sharedGroups] = await Promise.all([
      this.repo.getProfiles(uploaderIds),
      this.repo.findSharedGroupIds(viewerId, uploaderIds, festivalId),
    ]);
    const profileById = new Map(profiles.map((profile) => [profile.userId, profile]));

    return {
      photos: rows.map((row) => ({
        id: row.id,
        pictureUrl: row.pictureUrl,
        createdAt: row.createdAt,
        uploader: profileById.get(row.uploaderId) ?? {
          userId: row.uploaderId,
          username: null,
          fullName: null,
          avatarUrl: null,
        },
        groupId: sharedGroups.get(row.uploaderId) ?? null,
      })),
    };
  }
}

export function createPhotoTagService(supabase: SupabaseClient<Database>): PhotoTagService {
  const dayPlanRepo = new SupabaseDayPlanRepository(supabase);

  return new PhotoTagService(
    new SupabasePhotoTagRepository(supabase),
    async (userId, festivalId) =>
      (await dayPlanRepo.listCompanionOptions(userId, festivalId)).users.map((user) => user.userId),
    createNotificationService(supabase),
  );
}
