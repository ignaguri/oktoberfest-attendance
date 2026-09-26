import { ErrorCodes } from "@prostcounter/shared/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IPhotoTagRepository, PhotoTagTarget } from "../../repositories/interfaces";
import { PhotoTagService } from "../photo-tag.service";

const UPLOADER = "11111111-1111-4111-8111-111111111111";
const FRIEND_A = "22222222-2222-4222-8222-222222222222";
const FRIEND_B = "33333333-3333-4333-8333-333333333333";
const STRANGER = "44444444-4444-4444-8444-444444444444";
const PHOTO = "55555555-5555-4555-8555-555555555555";
const FESTIVAL = "66666666-6666-4666-8666-666666666666";
const GROUP = "77777777-7777-4777-8777-777777777777";

function makeRepo(overrides: Partial<IPhotoTagRepository> = {}, current: string[] = []) {
  const target: PhotoTagTarget = {
    photoId: PHOTO,
    uploaderId: UPLOADER,
    visibility: "public",
    festivalId: FESTIVAL,
  };
  const repo: IPhotoTagRepository = {
    getPhotoTarget: vi.fn().mockResolvedValue(target),
    listTaggedUserIds: vi.fn().mockResolvedValue(current),
    addTags: vi.fn().mockResolvedValue(undefined),
    removeTags: vi.fn().mockResolvedValue(undefined),
    getTaggedUsers: vi.fn().mockResolvedValue([]),
    listTaggedPhotos: vi.fn().mockResolvedValue([]),
    getProfiles: vi.fn().mockResolvedValue([]),
    findSharedGroupIds: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
  return repo;
}

describe("PhotoTagService.setTags", () => {
  const listCompanionUserIds = vi.fn();
  const notifier = { notifyPhotoTag: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    listCompanionUserIds.mockResolvedValue([FRIEND_A, FRIEND_B]);
    notifier.notifyPhotoTag.mockResolvedValue(undefined);
  });

  it("adds new tags and notifies only the added people", async () => {
    const repo = makeRepo({}, [FRIEND_A]);
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    const result = await service.setTags(PHOTO, UPLOADER, [FRIEND_A, FRIEND_B]);

    expect(repo.addTags).toHaveBeenCalledWith(PHOTO, [FRIEND_B]);
    expect(repo.removeTags).not.toHaveBeenCalled();
    expect(notifier.notifyPhotoTag).toHaveBeenCalledWith({
      photoId: PHOTO,
      taggerId: UPLOADER,
      festivalId: FESTIVAL,
      taggedUserIds: [FRIEND_B],
    });
    expect(result).toEqual({ taggedUsers: [], canEdit: true, festivalId: FESTIVAL });
  });

  it("removes people no longer in the set without notifying", async () => {
    const repo = makeRepo({}, [FRIEND_A, FRIEND_B]);
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await service.setTags(PHOTO, UPLOADER, [FRIEND_A]);

    expect(repo.removeTags).toHaveBeenCalledWith(PHOTO, [FRIEND_B]);
    expect(repo.addTags).not.toHaveBeenCalled();
    expect(notifier.notifyPhotoTag).not.toHaveBeenCalled();
  });

  it("re-sending the same set changes nothing and notifies nobody", async () => {
    const repo = makeRepo({}, [FRIEND_A]);
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await service.setTags(PHOTO, UPLOADER, [FRIEND_A]);

    expect(repo.addTags).not.toHaveBeenCalled();
    expect(repo.removeTags).not.toHaveBeenCalled();
    expect(notifier.notifyPhotoTag).not.toHaveBeenCalled();
  });

  it("clears every tag with an empty list and skips the companion lookup", async () => {
    const repo = makeRepo({}, [FRIEND_A]);
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await service.setTags(PHOTO, UPLOADER, []);

    expect(repo.removeTags).toHaveBeenCalledWith(PHOTO, [FRIEND_A]);
    expect(listCompanionUserIds).not.toHaveBeenCalled();
  });

  it("treats a photo you did not upload as not found", async () => {
    const repo = makeRepo({
      getPhotoTarget: vi.fn().mockResolvedValue({
        photoId: PHOTO,
        uploaderId: FRIEND_A,
        visibility: "public",
        festivalId: FESTIVAL,
      }),
    });
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_B])).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.addTags).not.toHaveBeenCalled();
  });

  it("treats a photo you cannot see as not found", async () => {
    const repo = makeRepo({ getPhotoTarget: vi.fn().mockResolvedValue(null) });
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_A])).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rejects tags on a private photo", async () => {
    const repo = makeRepo({
      getPhotoTarget: vi.fn().mockResolvedValue({
        photoId: PHOTO,
        uploaderId: UPLOADER,
        visibility: "private",
        festivalId: FESTIVAL,
      }),
    });
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_A])).rejects.toMatchObject({
      statusCode: 400,
      code: ErrorCodes.PHOTO_TAG_PRIVATE_PHOTO,
    });
  });

  it("rejects tagging yourself", async () => {
    const service = new PhotoTagService(makeRepo(), listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [UPLOADER])).rejects.toMatchObject({
      statusCode: 400,
      code: ErrorCodes.PHOTO_TAG_INVALID_USER,
    });
  });

  it("rejects someone who is not a friend or group-mate in the photo's festival", async () => {
    const repo = makeRepo();
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_A, STRANGER])).rejects.toMatchObject({
      statusCode: 400,
      code: ErrorCodes.PHOTO_TAG_INVALID_USER,
    });
    expect(listCompanionUserIds).toHaveBeenCalledWith(UPLOADER, FESTIVAL);
    expect(repo.addTags).not.toHaveBeenCalled();
  });

  it("keeps the tags when the notification fails", async () => {
    notifier.notifyPhotoTag.mockRejectedValue(new Error("novu down"));
    const repo = makeRepo();
    const service = new PhotoTagService(repo, listCompanionUserIds, notifier);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_A])).resolves.toMatchObject({
      canEdit: true,
    });
    expect(repo.addTags).toHaveBeenCalledWith(PHOTO, [FRIEND_A]);
  });

  it("works without a notifier (Novu not configured)", async () => {
    const repo = makeRepo();
    const service = new PhotoTagService(repo, listCompanionUserIds, null);

    await expect(service.setTags(PHOTO, UPLOADER, [FRIEND_A])).resolves.toBeDefined();
  });
});

describe("PhotoTagService.getTags", () => {
  it("lets the uploader edit a public photo", async () => {
    const service = new PhotoTagService(makeRepo(), vi.fn(), null);

    await expect(service.getTags(PHOTO, UPLOADER)).resolves.toEqual({
      taggedUsers: [],
      canEdit: true,
      festivalId: FESTIVAL,
    });
  });

  it("does not let anyone else edit", async () => {
    const service = new PhotoTagService(makeRepo(), vi.fn(), null);

    await expect(service.getTags(PHOTO, FRIEND_A)).resolves.toMatchObject({ canEdit: false });
  });

  it("is not found when the photo is not visible", async () => {
    const service = new PhotoTagService(
      makeRepo({ getPhotoTarget: vi.fn().mockResolvedValue(null) }),
      vi.fn(),
      null,
    );

    await expect(service.getTags(PHOTO, FRIEND_A)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PhotoTagService.getTaggedPhotos", () => {
  it("attaches the uploader and a shared group to each photo", async () => {
    const repo = makeRepo({
      listTaggedPhotos: vi
        .fn()
        .mockResolvedValue([
          {
            id: PHOTO,
            pictureUrl: "a/b.webp",
            createdAt: "2026-09-26T10:00:00Z",
            uploaderId: UPLOADER,
          },
        ]),
      getProfiles: vi
        .fn()
        .mockResolvedValue([
          { userId: UPLOADER, username: "user1", fullName: null, avatarUrl: null },
        ]),
      findSharedGroupIds: vi.fn().mockResolvedValue(new Map([[UPLOADER, GROUP]])),
    });
    const service = new PhotoTagService(repo, vi.fn(), null);

    const result = await service.getTaggedPhotos(FRIEND_A, FRIEND_A, FESTIVAL);

    expect(repo.listTaggedPhotos).toHaveBeenCalledWith(FRIEND_A, FESTIVAL, 30);
    expect(repo.findSharedGroupIds).toHaveBeenCalledWith(FRIEND_A, [UPLOADER], FESTIVAL);
    expect(result.photos).toEqual([
      {
        id: PHOTO,
        pictureUrl: "a/b.webp",
        createdAt: "2026-09-26T10:00:00Z",
        uploader: { userId: UPLOADER, username: "user1", fullName: null, avatarUrl: null },
        groupId: GROUP,
      },
    ]);
  });

  it("returns an empty list without further lookups", async () => {
    const repo = makeRepo();
    const service = new PhotoTagService(repo, vi.fn(), null);

    await expect(service.getTaggedPhotos(FRIEND_A, FRIEND_A, FESTIVAL)).resolves.toEqual({
      photos: [],
    });
    expect(repo.getProfiles).not.toHaveBeenCalled();
  });

  it("falls back to a bare uploader and no group", async () => {
    const repo = makeRepo({
      listTaggedPhotos: vi
        .fn()
        .mockResolvedValue([
          {
            id: PHOTO,
            pictureUrl: "a/b.webp",
            createdAt: "2026-09-26T10:00:00Z",
            uploaderId: UPLOADER,
          },
        ]),
    });
    const service = new PhotoTagService(repo, vi.fn(), null);

    const result = await service.getTaggedPhotos(STRANGER, FRIEND_A, FESTIVAL);

    expect(result.photos[0]).toMatchObject({
      uploader: { userId: UPLOADER, username: null, fullName: null, avatarUrl: null },
      groupId: null,
    });
  });
});
