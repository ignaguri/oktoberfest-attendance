import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPermissionsAsync = vi.fn();
const createAsset = vi.fn();
const warn = vi.fn();

vi.mock("expo-media-library", () => ({
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  Asset: { create: (...args: unknown[]) => createAsset(...args) },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: (...args: unknown[]) => warn(...args) } }));

import { saveToPhotoLibrary } from "../save-to-photo-library";

describe("saveToPhotoLibrary", () => {
  beforeEach(() => {
    requestPermissionsAsync.mockReset();
    createAsset.mockReset();
    warn.mockReset();
  });

  it("asks for write-only access and saves the photo", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    createAsset.mockResolvedValue({ id: "asset" });

    await saveToPhotoLibrary("file:///photo.jpg");

    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(createAsset).toHaveBeenCalledWith("file:///photo.jpg");
  });

  it("skips the save quietly when permission is denied", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(saveToPhotoLibrary("file:///photo.jpg")).resolves.toBeUndefined();

    expect(createAsset).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("never throws when the save fails, so the upload carries on", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    createAsset.mockRejectedValue(new Error("disk full"));

    await expect(saveToPhotoLibrary("file:///photo.jpg")).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[ImageUpload] Failed to save photo to library", {
      error: "disk full",
    });
  });

  it("never throws when the permission request itself fails", async () => {
    requestPermissionsAsync.mockRejectedValue(new Error("no activity"));

    await expect(saveToPhotoLibrary("file:///photo.jpg")).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
