import type { Database } from "@prostcounter/db";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createTestUser,
  dayFromToday,
  type TestFestival,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabasePhotoRepository } from "../photo.repository";

const BUCKET = "beer_pictures";

describe("signed-URL photo upload (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let userClient: SupabaseClient<Database>;
  let repo: SupabasePhotoRepository;
  let uploader: TestUser;
  let festival: TestFestival;
  let attendanceId: string;
  const storedPaths: string[] = [];

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    uploader = await createTestUser("photo-upload");
    festival = await createLiveFestival(admin);
    userClient = createTestSupabaseWithAuth(uploader.token);
    repo = new SupabasePhotoRepository(userClient);

    const { data: attendance, error } = await admin
      .from("attendances")
      .insert({ user_id: uploader.id, festival_id: festival.id, date: dayFromToday(0) })
      .select("id")
      .single();
    expect(error).toBeNull();
    attendanceId = attendance!.id;
  });

  afterAll(async () => {
    if (storedPaths.length > 0) {
      await admin.storage.from(BUCKET).remove(storedPaths);
    }
    await cleanupDayPlanFixtures(admin, {
      festivalIds: festival ? [festival.id] : [],
      tentIds: [],
      userIds: uploader ? [uploader.id] : [],
    });
  });

  async function startUpload(fileName: string) {
    return repo.getUploadUrl(uploader.id, {
      festivalId: festival.id,
      attendanceId,
      fileName,
      fileType: "image/webp",
      fileSize: 4,
    });
  }

  async function pendingPath(pictureId: string) {
    const { data } = await admin
      .from("photo_uploads")
      .select("picture_path")
      .eq("id", pictureId)
      .single();
    return data!.picture_path;
  }

  async function uploadFile(pictureId: string) {
    const path = await pendingPath(pictureId);
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, new Uint8Array([1, 2, 3, 4]), { contentType: "image/webp" });
    expect(error).toBeNull();
    storedPaths.push(path);
    return path;
  }

  async function pictureRow(pictureId: string) {
    const { data } = await admin.from("beer_pictures").select("*").eq("id", pictureId);
    return data ?? [];
  }

  it("creates no photo before the file is uploaded", async () => {
    const { pictureId } = await startUpload("pending.webp");

    expect(await pictureRow(pictureId)).toHaveLength(0);
  });

  it("clears the user's stale pending uploads when a new one starts", async () => {
    const { pictureId: stale } = await startUpload("stale.webp");
    const { pictureId: recent } = await startUpload("recent.webp");
    await admin
      .from("photo_uploads")
      .update({ created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
      .eq("id", stale);

    await startUpload("next.webp");

    const { data } = await admin.from("photo_uploads").select("id").in("id", [stale, recent]);
    expect(data?.map((row) => row.id)).toEqual([recent]);
  });

  it("refuses to confirm an upload whose file never reached storage", async () => {
    const { pictureId } = await startUpload("never-uploaded.webp");

    await expect(repo.confirmUpload(pictureId, uploader.id)).rejects.toMatchObject({
      code: ErrorCodes.PHOTO_UPLOAD_FAILED,
    });
    expect(await pictureRow(pictureId)).toHaveLength(0);
  });

  it("creates the photo under the upload's id once the file exists", async () => {
    const { pictureId } = await startUpload("uploaded.webp");
    const path = await uploadFile(pictureId);

    const picture = await repo.confirmUpload(pictureId, uploader.id);

    expect(picture).toMatchObject({ id: pictureId, pictureUrl: path, attendanceId });
    expect(await pictureRow(pictureId)).toHaveLength(1);
    const { data: pending } = await admin.from("photo_uploads").select("id").eq("id", pictureId);
    expect(pending).toHaveLength(0);
  });

  it("confirming twice returns the same photo", async () => {
    const { pictureId } = await startUpload("twice.webp");
    await uploadFile(pictureId);

    await repo.confirmUpload(pictureId, uploader.id);
    const again = await repo.confirmUpload(pictureId, uploader.id);

    expect(again.id).toBe(pictureId);
    expect(await pictureRow(pictureId)).toHaveLength(1);
  });

  it("still confirms a photo row created by the old upload flow", async () => {
    const { data: legacy, error } = await admin
      .from("beer_pictures")
      .insert({ user_id: uploader.id, attendance_id: attendanceId, picture_url: "legacy.webp" })
      .select("id")
      .single();
    expect(error).toBeNull();

    await expect(repo.confirmUpload(legacy!.id, uploader.id)).resolves.toMatchObject({
      id: legacy!.id,
    });
  });

  it("does not confirm someone else's upload", async () => {
    const { pictureId } = await startUpload("mine.webp");
    await uploadFile(pictureId);
    const other = await createTestUser("photo-upload-other");

    try {
      const otherRepo = new SupabasePhotoRepository(createTestSupabaseWithAuth(other.token));
      await expect(otherRepo.confirmUpload(pictureId, other.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    } finally {
      await cleanupDayPlanFixtures(admin, { festivalIds: [], tentIds: [], userIds: [other.id] });
    }
  });
});
