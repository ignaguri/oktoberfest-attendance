import type { Database } from "@prostcounter/db";
import { groupFriendsWent } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createSharedGroup,
  createTestTent,
  createTestUser,
  dayFromToday,
  DAY_PLAN_TEST_TIMEZONE,
  makeFriends,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  cleanupAttendanceFixtures,
  insertAttendance,
  insertConsumption,
  insertPhoto,
  insertTentVisit,
} from "../../../__tests__/helpers/friends-went-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseFriendsWentRepository } from "../friends-went.repository";

describe("SupabaseFriendsWentRepository (Local DB)", () => {
  const pastDate = dayFromToday(-1);

  let admin: SupabaseClient<Database>;
  let viewer: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let stranger: TestUser;
  let superAdmin: TestUser;
  let festival: TestFestival;
  let tent: TestTent;
  let olderGroupId: string;
  let newerGroupId: string;
  let friendAttendanceId: string;
  let publicPhotoId: string;
  let viewerRepo: SupabaseFriendsWentRepository;
  let strangerRepo: SupabaseFriendsWentRepository;
  let superAdminRepo: SupabaseFriendsWentRepository;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    viewer = await createTestUser("fw-viewer");
    friend = await createTestUser("fw-friend");
    groupMate = await createTestUser("fw-mate");
    stranger = await createTestUser("fw-stranger");
    superAdmin = await createTestUser("fw-admin");
    festival = await createLiveFestival(admin);
    tent = await createTestTent(admin);

    const { error: superAdminError } = await admin
      .from("profiles")
      .update({ is_super_admin: true })
      .eq("id", superAdmin.id);

    if (superAdminError) {
      throw new Error(`Failed to mark super admin: ${superAdminError.message}`);
    }

    await makeFriends(admin, viewer.id, friend.id);
    olderGroupId = await createSharedGroup(admin, festival.id, [viewer.id, groupMate.id]);
    newerGroupId = await createSharedGroup(admin, festival.id, [viewer.id, groupMate.id]);
    await admin
      .from("group_members")
      .update({ joined_at: "2026-01-01T00:00:00Z" })
      .eq("group_id", olderGroupId)
      .eq("user_id", viewer.id);
    await admin
      .from("group_members")
      .update({ joined_at: "2026-02-01T00:00:00Z" })
      .eq("group_id", newerGroupId)
      .eq("user_id", viewer.id);

    friendAttendanceId = await insertAttendance(admin, friend.id, festival.id, pastDate);
    await insertConsumption(admin, friendAttendanceId, "beer");
    await insertConsumption(admin, friendAttendanceId, "beer");
    await insertConsumption(admin, friendAttendanceId, "radler");
    await insertTentVisit(admin, {
      userId: friend.id,
      festivalId: festival.id,
      tentId: tent.id,
      visitDate: `${pastDate}T12:00:00.000Z`,
    });
    publicPhotoId = await insertPhoto(admin, {
      userId: friend.id,
      attendanceId: friendAttendanceId,
      visibility: "public",
    });
    await insertPhoto(admin, {
      userId: friend.id,
      attendanceId: friendAttendanceId,
      visibility: "private",
    });

    await insertAttendance(admin, groupMate.id, festival.id, pastDate);
    const strangerAttendanceId = await insertAttendance(admin, stranger.id, festival.id, pastDate);
    await insertConsumption(admin, strangerAttendanceId, "wine");
    await insertAttendance(admin, viewer.id, festival.id, pastDate);

    viewerRepo = new SupabaseFriendsWentRepository(createTestSupabaseWithAuth(viewer.token));
    strangerRepo = new SupabaseFriendsWentRepository(createTestSupabaseWithAuth(stranger.token));
    superAdminRepo = new SupabaseFriendsWentRepository(createTestSupabaseWithAuth(superAdmin.token));
  });

  afterAll(async () => {
    await cleanupAttendanceFixtures(admin, [festival.id]);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id],
      tentIds: [tent.id],
      userIds: [viewer.id, friend.id, groupMate.id, stranger.id, superAdmin.id],
    });
  });

  it("reads the festival's timezone, and null for an unknown festival", async () => {
    expect(await viewerRepo.getFestivalTimezone(festival.id)).toBe(DAY_PLAN_TEST_TIMEZONE);
    expect(await viewerRepo.getFestivalTimezone(randomUUID())).toBeNull();
  });

  it("returns friends' and group-mates' attendance, never the viewer's or a stranger's", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);

    expect(rows.attendances.map((row) => row.userId).sort()).toEqual(
      [friend.id, groupMate.id].sort(),
    );
    expect(rows.profiles.map((profile) => profile.userId).sort()).toEqual(
      [friend.id, groupMate.id].sort(),
    );
  });

  it("lets a friend's drinks through RLS", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);

    expect(
      rows.consumptions.filter((row) => row.attendanceId === friendAttendanceId),
    ).toHaveLength(3);
  });

  it("returns only public photos", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);

    expect(rows.photos.map((photo) => photo.id)).toEqual([publicPhotoId]);
  });

  it("returns tent visits with tent names", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);

    expect(rows.tentVisits).toEqual([
      expect.objectContaining({ userId: friend.id, tentName: tent.name }),
    ]);
  });

  it("returns the viewer's groups in the festival and who else is in them", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);

    expect(rows.viewerGroups.map((group) => group.groupId).sort()).toEqual(
      [olderGroupId, newerGroupId].sort(),
    );
    expect(rows.groupMemberships.map((membership) => membership.userId)).toEqual([
      groupMate.id,
      groupMate.id,
    ]);
  });

  it("feeds the grouping end to end", async () => {
    const rows = await viewerRepo.listDayRows(viewer.id, festival.id, pastDate);
    const friends = groupFriendsWent({
      date: pastDate,
      timezone: DAY_PLAN_TEST_TIMEZONE,
      ...rows,
    });

    expect(friends).toEqual([
      expect.objectContaining({
        userId: friend.id,
        totalDrinks: 3,
        drinks: [
          { type: "beer", count: 2 },
          { type: "radler", count: 1 },
        ],
        tents: [tent.name],
        photoCount: 1,
        sharedGroupId: null,
      }),
      expect.objectContaining({ userId: groupMate.id, totalDrinks: 0, sharedGroupId: newerGroupId }),
    ]);
  });

  it("shows a stranger nobody", async () => {
    const rows = await strangerRepo.listDayRows(stranger.id, festival.id, pastDate);

    expect(rows.attendances).toEqual([]);
  });

  it("lists nobody for a super admin with no friends or groups", async () => {
    const rows = await superAdminRepo.listDayRows(superAdmin.id, festival.id, pastDate);

    expect(rows.attendances).toEqual([]);
  });
});
