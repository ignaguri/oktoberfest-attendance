import { ErrorCodes } from "@prostcounter/shared/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGroupInvitationRepository } from "../../repositories/interfaces";
import { GroupInvitationService } from "../group-invitation.service";

const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const INVITATION_ID = "44444444-4444-4444-8444-444444444444";
const INVITER_ID = "11111111-1111-4111-8111-111111111111";
const INVITEE_ID = "22222222-2222-4222-8222-222222222222";
const FESTIVAL_ID = "55555555-5555-4555-8555-555555555555";

describe("GroupInvitationService", () => {
  let repo: IGroupInvitationRepository;
  let service: GroupInvitationService;

  beforeEach(() => {
    repo = {
      invite: vi.fn().mockResolvedValue({ success: true, invitationId: INVITATION_ID }),
      accept: vi.fn().mockResolvedValue({
        success: true,
        invitationId: INVITATION_ID,
        groupId: GROUP_ID,
        inviterId: INVITER_ID,
        inviteeId: INVITEE_ID,
        festivalId: FESTIVAL_ID,
      }),
      decline: vi.fn().mockResolvedValue({ success: true, invitationId: INVITATION_ID }),
      cancel: vi.fn().mockResolvedValue({ success: true, invitationId: INVITATION_ID }),
      listIncoming: vi.fn().mockResolvedValue([]),
      listSent: vi.fn().mockResolvedValue([]),
      listInvitableUsers: vi.fn().mockResolvedValue([]),
    };
    service = new GroupInvitationService(repo);
  });

  it("returns the new invitation id", async () => {
    await expect(service.invite(GROUP_ID, INVITEE_ID)).resolves.toEqual({
      invitationId: INVITATION_ID,
    });
    expect(repo.invite).toHaveBeenCalledWith(GROUP_ID, INVITEE_ID);
  });

  it.each([
    ["UNAUTHORIZED", ErrorCodes.UNAUTHORIZED, 401],
    ["NOT_GROUP_CREATOR", ErrorCodes.NOT_GROUP_CREATOR, 403],
    ["CANNOT_INVITE_SELF", ErrorCodes.CANNOT_INVITE_SELF, 403],
    ["PROFILE_NOT_FOUND", ErrorCodes.PROFILE_NOT_FOUND, 404],
    ["ALREADY_GROUP_MEMBER", ErrorCodes.ALREADY_GROUP_MEMBER, 409],
    ["GROUP_INVITATION_PENDING", ErrorCodes.GROUP_INVITATION_PENDING, 409],
    ["JOIN_REQUEST_PENDING", ErrorCodes.JOIN_REQUEST_PENDING, 409],
  ])("maps a %s invite failure", async (errorCode, code, statusCode) => {
    vi.mocked(repo.invite).mockResolvedValue({ success: false, errorCode });
    await expect(service.invite(GROUP_ID, INVITEE_ID)).rejects.toMatchObject({ code, statusCode });
  });

  it("returns who and where on accept", async () => {
    await expect(service.accept(INVITATION_ID)).resolves.toEqual({
      groupId: GROUP_ID,
      inviterId: INVITER_ID,
      inviteeId: INVITEE_ID,
      festivalId: FESTIVAL_ID,
    });
  });

  it.each([
    ["GROUP_INVITATION_NOT_FOUND", ErrorCodes.GROUP_INVITATION_NOT_FOUND, 404],
    ["NOT_INVITATION_RECIPIENT", ErrorCodes.NOT_INVITATION_RECIPIENT, 403],
  ])("maps a %s accept failure", async (errorCode, code, statusCode) => {
    vi.mocked(repo.accept).mockResolvedValue({ success: false, errorCode });
    await expect(service.accept(INVITATION_ID)).rejects.toMatchObject({ code, statusCode });
  });

  it("maps a decline failure", async () => {
    vi.mocked(repo.decline).mockResolvedValue({
      success: false,
      errorCode: "NOT_INVITATION_RECIPIENT",
    });
    await expect(service.decline(INVITATION_ID)).rejects.toMatchObject({
      code: ErrorCodes.NOT_INVITATION_RECIPIENT,
      statusCode: 403,
    });
  });

  it("maps a cancel failure", async () => {
    vi.mocked(repo.cancel).mockResolvedValue({ success: false, errorCode: "NOT_GROUP_CREATOR" });
    await expect(service.cancel(INVITATION_ID)).rejects.toMatchObject({
      code: ErrorCodes.NOT_GROUP_CREATOR,
      statusCode: 403,
    });
  });

  it("maps an unknown error code to a conflict", async () => {
    vi.mocked(repo.decline).mockResolvedValue({ success: false, errorCode: "SOMETHING_NEW" });
    await expect(service.decline(INVITATION_ID)).rejects.toMatchObject({
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });
  });

  it("passes a search straight through to the repository", async () => {
    await service.listInvitableUsers(INVITER_ID, GROUP_ID, "ana");
    expect(repo.listInvitableUsers).toHaveBeenCalledWith(INVITER_ID, GROUP_ID, "ana");
  });
});
