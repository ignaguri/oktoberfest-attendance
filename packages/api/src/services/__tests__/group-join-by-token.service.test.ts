import type { Group } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGroupRepository } from "../../repositories/interfaces";
import { GroupService } from "../group.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "b0d2a1b9-7b1e-41cd-be6e-48418d0c6f11";

const group = { id: "33333333-3333-4333-8333-333333333333", inviteToken: TOKEN } as Group;

describe("GroupService.joinByToken", () => {
  let repo: IGroupRepository;
  let service: GroupService;

  beforeEach(() => {
    repo = {
      findByInviteToken: vi.fn().mockResolvedValue(group),
      addMember: vi.fn().mockResolvedValue(undefined),
    } as unknown as IGroupRepository;
    service = new GroupService(repo);
  });

  it("joins with a plain token", async () => {
    await expect(service.joinByToken(TOKEN, USER_ID)).resolves.toBe(group);
    expect(repo.findByInviteToken).toHaveBeenCalledWith(TOKEN);
  });

  it("recovers the token from a link mangled by a share target", async () => {
    const mangled = `${TOKEN} https://prostcounter.fun/join-group?token=${TOKEN}`;

    await service.joinByToken(mangled, USER_ID);

    expect(repo.findByInviteToken).toHaveBeenCalledWith(TOKEN);
  });

  it("accepts a pasted invite URL and uppercase tokens", async () => {
    await service.joinByToken(
      ` https://www.prostcounter.fun/join-group?token=${TOKEN.toUpperCase()}\n`,
      USER_ID,
    );

    expect(repo.findByInviteToken).toHaveBeenCalledWith(TOKEN);
  });

  it("rejects input without a UUID as an invalid token, without hitting the DB", async () => {
    await expect(service.joinByToken("not-a-token", USER_ID)).rejects.toMatchObject({
      code: ErrorCodes.INVALID_INVITE_TOKEN,
    });
    expect(repo.findByInviteToken).not.toHaveBeenCalled();
  });
});
