import { describe, expect, it } from "vitest";

import { type FriendsWentInput, groupFriendsWent } from "./friends-went";

const DATE = "2026-09-26";
const ANA = "11111111-1111-4111-8111-111111111111";
const JUAN = "22222222-2222-4222-8222-222222222222";
const BEA = "33333333-3333-4333-8333-333333333333";
const ANA_ATTENDANCE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JUAN_ATTENDANCE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BEA_ATTENDANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GROUP_A = "a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0";
const GROUP_B = "b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0";
const GROUP_C = "c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0";

function input(overrides: Partial<FriendsWentInput> = {}): FriendsWentInput {
  return {
    date: DATE,
    timezone: "Europe/Berlin",
    attendances: [{ attendanceId: ANA_ATTENDANCE, userId: ANA }],
    profiles: [{ userId: ANA, username: "ana", fullName: null, avatarUrl: null }],
    consumptions: [],
    tentVisits: [],
    photos: [],
    viewerGroups: [],
    groupMemberships: [],
    ...overrides,
  };
}

describe("groupFriendsWent", () => {
  it("counts drinks by type, most first, ties in drink-type order", () => {
    const [ana] = groupFriendsWent(
      input({
        consumptions: [
          { attendanceId: ANA_ATTENDANCE, drinkType: "soft_drink" },
          { attendanceId: ANA_ATTENDANCE, drinkType: "radler" },
          { attendanceId: ANA_ATTENDANCE, drinkType: "beer" },
          { attendanceId: ANA_ATTENDANCE, drinkType: "radler" },
          { attendanceId: ANA_ATTENDANCE, drinkType: "beer" },
          { attendanceId: JUAN_ATTENDANCE, drinkType: "wine" },
        ],
      }),
    );

    expect(ana.drinks).toEqual([
      { type: "beer", count: 2 },
      { type: "radler", count: 2 },
      { type: "soft_drink", count: 1 },
    ]);
    expect(ana.totalDrinks).toBe(5);
  });

  it("keeps a friend who logged no drinks, with their profile", () => {
    expect(groupFriendsWent(input())).toEqual([
      {
        userId: ANA,
        username: "ana",
        fullName: null,
        avatarUrl: null,
        totalDrinks: 0,
        drinks: [],
        tents: [],
        photoCount: 0,
        photos: [],
        sharedGroupId: null,
      },
    ]);
  });

  it("lists distinct tents in visit order on the festival's clock", () => {
    const [ana] = groupFriendsWent(
      input({
        tentVisits: [
          { userId: ANA, tentName: "Augustiner", visitDate: "2026-09-26T16:00:00Z" },
          { userId: ANA, tentName: "Hofbräu", visitDate: "2026-09-26T12:00:00Z" },
          { userId: ANA, tentName: "Hofbräu", visitDate: "2026-09-26T18:00:00Z" },
          // 00:30 on Sep 26 in Munich: belongs to the day
          { userId: ANA, tentName: "Schottenhamel", visitDate: "2026-09-25T22:30:00Z" },
          // 00:30 on Sep 27 in Munich: the next day
          { userId: ANA, tentName: "Löwenbräu", visitDate: "2026-09-26T22:30:00Z" },
          { userId: ANA, tentName: null, visitDate: "2026-09-26T13:00:00Z" },
          { userId: JUAN, tentName: "Paulaner", visitDate: "2026-09-26T13:00:00Z" },
        ],
      }),
    );

    expect(ana.tents).toEqual(["Schottenhamel", "Hofbräu", "Augustiner"]);
  });

  it("returns the newest three photos and counts all of them", () => {
    const photoIds = ["photo-1", "photo-2", "photo-3", "photo-4", "photo-5"];
    const [ana] = groupFriendsWent(
      input({
        photos: photoIds.map((id, index) => ({
          id,
          attendanceId: ANA_ATTENDANCE,
          pictureUrl: `ana/${index + 1}.jpg`,
          createdAt: `2026-09-26T1${index}:00:00Z`,
        })),
      }),
    );

    expect(ana.photoCount).toBe(5);
    expect(ana.photos).toEqual([
      { id: photoIds[4], pictureUrl: "ana/5.jpg" },
      { id: photoIds[3], pictureUrl: "ana/4.jpg" },
      { id: photoIds[2], pictureUrl: "ana/3.jpg" },
    ]);
  });

  it("picks the shared group the viewer joined most recently", () => {
    const [ana] = groupFriendsWent(
      input({
        viewerGroups: [
          { groupId: GROUP_A, joinedAt: "2026-09-01T10:00:00+00:00" },
          { groupId: GROUP_B, joinedAt: "2026-09-10T10:00:00+00:00" },
          { groupId: GROUP_C, joinedAt: null },
        ],
        groupMemberships: [
          { groupId: GROUP_A, userId: ANA },
          { groupId: GROUP_B, userId: ANA },
          { groupId: GROUP_C, userId: ANA },
        ],
      }),
    );

    expect(ana.sharedGroupId).toBe(GROUP_B);
  });

  it("puts groups with no join date last and breaks ties by id", () => {
    const [withDate] = groupFriendsWent(
      input({
        viewerGroups: [
          { groupId: GROUP_A, joinedAt: null },
          { groupId: GROUP_C, joinedAt: "2026-09-01T10:00:00+00:00" },
        ],
        groupMemberships: [
          { groupId: GROUP_A, userId: ANA },
          { groupId: GROUP_C, userId: ANA },
        ],
      }),
    );
    const [noDates] = groupFriendsWent(
      input({
        viewerGroups: [
          { groupId: GROUP_B, joinedAt: null },
          { groupId: GROUP_A, joinedAt: null },
        ],
        groupMemberships: [
          { groupId: GROUP_B, userId: ANA },
          { groupId: GROUP_A, userId: ANA },
        ],
      }),
    );

    expect(withDate.sharedGroupId).toBe(GROUP_C);
    expect(noDates.sharedGroupId).toBe(GROUP_A);
  });

  it("has no shared group for a friend outside the viewer's groups", () => {
    const [ana] = groupFriendsWent(
      input({
        viewerGroups: [{ groupId: GROUP_A, joinedAt: null }],
        groupMemberships: [{ groupId: GROUP_A, userId: JUAN }],
      }),
    );

    expect(ana.sharedGroupId).toBeNull();
  });

  it("sorts by most drinks, then name ignoring case", () => {
    const friends = groupFriendsWent(
      input({
        attendances: [
          { attendanceId: BEA_ATTENDANCE, userId: BEA },
          { attendanceId: ANA_ATTENDANCE, userId: ANA },
          { attendanceId: JUAN_ATTENDANCE, userId: JUAN },
        ],
        profiles: [
          { userId: ANA, username: "ana", fullName: null, avatarUrl: null },
          { userId: JUAN, username: "Juan", fullName: null, avatarUrl: null },
          { userId: BEA, username: null, fullName: "Bea", avatarUrl: null },
        ],
        consumptions: [
          { attendanceId: JUAN_ATTENDANCE, drinkType: "beer" },
          { attendanceId: JUAN_ATTENDANCE, drinkType: "beer" },
        ],
      }),
    );

    expect(friends.map((friend) => friend.userId)).toEqual([JUAN, ANA, BEA]);
  });

  it("returns nothing when nobody went", () => {
    expect(groupFriendsWent(input({ attendances: [] }))).toEqual([]);
  });
});
