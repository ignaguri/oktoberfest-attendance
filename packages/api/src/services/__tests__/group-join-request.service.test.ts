import { ErrorCodes } from "@prostcounter/shared/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGroupJoinRequestRepository } from "../../repositories/interfaces";
import { GroupJoinRequestService } from "../group-join-request.service";

const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const REQUESTER_ID = "11111111-1111-4111-8111-111111111111";
const FESTIVAL_ID = "55555555-5555-4555-8555-555555555555";

describe("GroupJoinRequestService", () => {
  let repo: IGroupJoinRequestRepository;
  let service: GroupJoinRequestService;

  beforeEach(() => {
    repo = {
      request: vi.fn().mockResolvedValue({ success: true, requestId: REQUEST_ID }),
      accept: vi.fn().mockResolvedValue({
        success: true,
        requestId: REQUEST_ID,
        groupId: GROUP_ID,
        requesterId: REQUESTER_ID,
        festivalId: FESTIVAL_ID,
      }),
      decline: vi.fn().mockResolvedValue({ success: true, requestId: REQUEST_ID, groupId: GROUP_ID }),
      cancel: vi.fn().mockResolvedValue(undefined),
      listIncoming: vi.fn().mockResolvedValue([]),
      listBlockingGroupIds: vi.fn().mockResolvedValue([]),
    };
    service = new GroupJoinRequestService(repo);
  });

  it("sends a request and notifies the creator by default", async () => {
    await expect(service.request(GROUP_ID)).resolves.toEqual({ notifyCreator: true });
    expect(repo.request).toHaveBeenCalledWith(GROUP_ID);
  });

  it("skips the creator notification when the request function says so", async () => {
    vi.mocked(repo.request).mockResolvedValue({
      success: true,
      requestId: REQUEST_ID,
      notifyCreator: false,
    });
    await expect(service.request(GROUP_ID)).resolves.toEqual({ notifyCreator: false });
  });

  it.each([
    ["GROUP_NOT_FOUND", ErrorCodes.GROUP_NOT_FOUND, 404],
    ["ALREADY_GROUP_MEMBER", ErrorCodes.ALREADY_GROUP_MEMBER, 409],
    ["JOIN_REQUEST_PENDING", ErrorCodes.JOIN_REQUEST_PENDING, 409],
    ["UNAUTHORIZED", ErrorCodes.UNAUTHORIZED, 401],
  ])("maps a %s request failure", async (errorCode, code, statusCode) => {
    vi.mocked(repo.request).mockResolvedValue({ success: false, errorCode });
    await expect(service.request(GROUP_ID)).rejects.toMatchObject({ code, statusCode });
  });

  it("returns who and where on accept", async () => {
    await expect(service.accept(REQUEST_ID)).resolves.toEqual({
      groupId: GROUP_ID,
      requesterId: REQUESTER_ID,
      festivalId: FESTIVAL_ID,
    });
  });

  it.each([
    ["JOIN_REQUEST_NOT_FOUND", ErrorCodes.JOIN_REQUEST_NOT_FOUND, 404],
    ["NOT_GROUP_CREATOR", ErrorCodes.NOT_GROUP_CREATOR, 403],
  ])("maps a %s accept failure", async (errorCode, code, statusCode) => {
    vi.mocked(repo.accept).mockResolvedValue({ success: false, errorCode });
    await expect(service.accept(REQUEST_ID)).rejects.toMatchObject({ code, statusCode });
  });

  it("maps a decline failure", async () => {
    vi.mocked(repo.decline).mockResolvedValue({ success: false, errorCode: "NOT_GROUP_CREATOR" });
    await expect(service.decline(REQUEST_ID)).rejects.toMatchObject({
      code: ErrorCodes.NOT_GROUP_CREATOR,
      statusCode: 403,
    });
  });

  it("maps an unknown error code to a conflict", async () => {
    vi.mocked(repo.decline).mockResolvedValue({ success: false, errorCode: "SOMETHING_NEW" });
    await expect(service.decline(REQUEST_ID)).rejects.toMatchObject({
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });
  });
});
