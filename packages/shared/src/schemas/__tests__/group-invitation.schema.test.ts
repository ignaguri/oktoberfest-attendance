import { describe, expect, it } from "vitest";

import {
  GroupInvitationSchema,
  InvitableUserSchema,
  InviteToGroupSchema,
} from "../group-invitation.schema";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("GroupInvitationSchema", () => {
  it("accepts an invitation with a fully populated inviter", () => {
    const parsed = GroupInvitationSchema.parse({
      id: UUID_A,
      groupId: UUID_B,
      groupName: "Bierfreunde",
      festivalId: UUID_A,
      createdAt: "2026-09-22T10:00:00.000Z",
      inviter: {
        id: UUID_B,
        username: "ana",
        fullName: "Ana Garcia",
        avatarUrl: null,
      },
    });

    expect(parsed.inviter.username).toBe("ana");
  });

  it("accepts an inviter whose profile fields are all null", () => {
    expect(() =>
      GroupInvitationSchema.parse({
        id: UUID_A,
        groupId: UUID_B,
        groupName: "Bierfreunde",
        festivalId: UUID_A,
        createdAt: "2026-09-22T10:00:00.000Z",
        inviter: { id: UUID_B, username: null, fullName: null, avatarUrl: null },
      }),
    ).not.toThrow();
  });
});

describe("InvitableUserSchema", () => {
  it.each(["none", "invited", "member", "requested"] as const)(
    "accepts the %s invitation status",
    (invitationStatus) => {
      const parsed = InvitableUserSchema.parse({
        id: UUID_A,
        username: "ana",
        fullName: null,
        avatarUrl: null,
        invitationStatus,
        invitationId: invitationStatus === "invited" ? UUID_B : null,
      });

      expect(parsed.invitationStatus).toBe(invitationStatus);
    },
  );

  it("rejects an unknown invitation status", () => {
    expect(() =>
      InvitableUserSchema.parse({
        id: UUID_A,
        username: null,
        fullName: null,
        avatarUrl: null,
        invitationStatus: "maybe",
        invitationId: null,
      }),
    ).toThrow();
  });
});

describe("InviteToGroupSchema", () => {
  it("requires a uuid invitee id", () => {
    expect(() => InviteToGroupSchema.parse({ inviteeId: "not-a-uuid" })).toThrow();
    expect(InviteToGroupSchema.parse({ inviteeId: UUID_A }).inviteeId).toBe(UUID_A);
  });
});
