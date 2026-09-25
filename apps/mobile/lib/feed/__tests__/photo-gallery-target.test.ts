import { describe, expect, it } from "vitest";

import { getPhotoGalleryTarget } from "../photo-gallery-target";

describe("getPhotoGalleryTarget", () => {
  it("opens the group gallery viewer when the viewer shares a group with the uploader", () => {
    expect(getPhotoGalleryTarget({ picture_id: "pic-1", shared_group_id: "group-1" })).toEqual({
      photoId: "pic-1",
      groupId: "group-1",
    });
  });

  it("falls back to the plain preview without a shared group", () => {
    expect(getPhotoGalleryTarget({ picture_id: "pic-1", shared_group_id: null })).toBeNull();
  });

  it("falls back for feed items cached before the picture id existed", () => {
    expect(getPhotoGalleryTarget({ picture_url: "a.jpg" })).toBeNull();
    expect(getPhotoGalleryTarget(null)).toBeNull();
  });
});
