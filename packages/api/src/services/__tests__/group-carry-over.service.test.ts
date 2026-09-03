import type { CarryOverCandidate, Group, GroupWithMembers } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGroupRepository } from "../../repositories/interfaces";
import { GroupService } from "../group.service";

const CREATOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_FESTIVAL_ID = "44444444-4444-4444-8444-444444444444";
const TARGET_FESTIVAL_ID = "55555555-5555-4555-8555-555555555555";
const NEW_GROUP_ID = "66666666-6666-4666-8666-666666666666";

function buildSourceGroup(): GroupWithMembers {
  return {
    id: SOURCE_GROUP_ID,
    name: "Wiesn Crew",
    festivalId: SOURCE_FESTIVAL_ID,
    winningCriteria: "total_beers",
    inviteToken: "token-source",
    createdBy: CREATOR_ID,
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2025-09-01T00:00:00.000Z",
    memberCount: 4,
  };
}

function buildCarriedGroup(): Group {
  return {
    id: NEW_GROUP_ID,
    name: "Wiesn Crew",
    festivalId: TARGET_FESTIVAL_ID,
    winningCriteria: "total_beers",
    inviteToken: "token-new",
    createdBy: CREATOR_ID,
    carriedOverFrom: SOURCE_GROUP_ID,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
  };
}

describe("GroupService carry-over", () => {
  let repo: IGroupRepository;
  let service: GroupService;

  beforeEach(() => {
    repo = {
      findById: vi.fn().mockResolvedValue(buildSourceGroup()),
      isCreator: vi.fn().mockResolvedValue(true),
      getFestivalEndDate: vi.fn().mockResolvedValue("2999-10-04"),
      findCarryOverTarget: vi.fn().mockResolvedValue(null),
      carryOver: vi.fn().mockResolvedValue(buildCarriedGroup()),
      listCarryOverCandidates: vi.fn().mockResolvedValue([]),
    } as unknown as IGroupRepository;

    service = new GroupService(repo);
  });

  it("carries a group over into the target festival", async () => {
    const result = await service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, TARGET_FESTIVAL_ID);

    expect(result.id).toBe(NEW_GROUP_ID);
    expect(result.festivalId).toBe(TARGET_FESTIVAL_ID);
    expect(result.carriedOverFrom).toBe(SOURCE_GROUP_ID);
    expect(repo.carryOver).toHaveBeenCalledWith(CREATOR_ID, SOURCE_GROUP_ID, TARGET_FESTIVAL_ID);
  });

  it("rejects a non-creator", async () => {
    vi.mocked(repo.isCreator).mockResolvedValue(false);

    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, OTHER_USER_ID, TARGET_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.NOT_GROUP_CREATOR);
    expect(repo.carryOver).not.toHaveBeenCalled();
  });

  it("rejects a missing source group", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, TARGET_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.GROUP_NOT_FOUND);
  });

  it("rejects carrying a group into its own festival", async () => {
    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, SOURCE_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.GROUP_ALREADY_CARRIED_OVER);
    expect(repo.carryOver).not.toHaveBeenCalled();
  });

  it("rejects a target festival that does not exist", async () => {
    vi.mocked(repo.getFestivalEndDate).mockResolvedValue(null);

    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, TARGET_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.FESTIVAL_NOT_FOUND);
  });

  it("rejects a target festival that has already ended", async () => {
    vi.mocked(repo.getFestivalEndDate).mockResolvedValue("2020-10-04");

    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, TARGET_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.FESTIVAL_ENDED);
    expect(repo.carryOver).not.toHaveBeenCalled();
  });

  it("rejects a group that was already carried over", async () => {
    vi.mocked(repo.findCarryOverTarget).mockResolvedValue(NEW_GROUP_ID);

    await expect(
      service.carryOverGroup(SOURCE_GROUP_ID, CREATOR_ID, TARGET_FESTIVAL_ID),
    ).rejects.toThrow(ErrorCodes.GROUP_ALREADY_CARRIED_OVER);
    expect(repo.carryOver).not.toHaveBeenCalled();
  });

  it("lists candidates from the repository", async () => {
    const candidate: CarryOverCandidate = {
      groupId: SOURCE_GROUP_ID,
      name: "Wiesn Crew",
      winningCriteria: "total_beers",
      memberCount: 4,
      sourceFestivalId: SOURCE_FESTIVAL_ID,
      sourceFestivalName: "Oktoberfest 2025",
    };
    vi.mocked(repo.listCarryOverCandidates).mockResolvedValue([candidate]);

    const result = await service.listCarryOverCandidates(CREATOR_ID, TARGET_FESTIVAL_ID);

    expect(result).toEqual([candidate]);
  });
});
