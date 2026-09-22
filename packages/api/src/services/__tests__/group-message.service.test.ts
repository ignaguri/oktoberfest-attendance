import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "../../utils/admin-client";
import { NotificationService } from "../notification.service";

const { triggerMock } = vi.hoisted(() => ({ triggerMock: vi.fn() }));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
  },
}));

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(),
}));

const AUTHOR_ID = "11111111-1111-4111-8111-111111111111";
const MATE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_MATE_ID = "33333333-3333-4333-8333-333333333333";
const FESTIVAL_ID = "44444444-4444-4444-8444-444444444444";
const GROUP_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_GROUP_ID = "66666666-6666-4666-8666-666666666666";

function mockAdminClientReturning(prefs: Array<{ user_id: string; group_notifications_enabled?: boolean | null }>) {
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: prefs, error: null }),
      }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
  return client;
}

/**
 * Four reads go through the request-scoped client:
 *  - the shared-member view, which determines WHO gets notified (not touched
 *    for group_id — the view doesn't carry it)
 *  - the author's own group memberships in this festival
 *  - the members of those groups, used only to resolve a deep-link group id
 *    per recipient (best effort — never gates who gets notified)
 *  - the author's profile
 */
function mockRequestScopedSupabase(options: {
  viewers?: Array<{ viewer_id: string }>;
  authorGroupIds?: string[];
  coMembers?: Array<{ user_id: string; group_id: string }>;
  authorGroupsError?: boolean;
  coMembersError?: boolean;
}) {
  const {
    viewers = [],
    authorGroupIds = [],
    coMembers = [],
    authorGroupsError = false,
    coMembersError = false,
  } = options;

  return {
    from: vi.fn((table: string) => {
      if (table === "v_user_shared_group_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: viewers, error: null }),
            }),
          }),
        };
      }

      if (table === "group_members") {
        return {
          select: vi.fn((fields: string) => {
            // Author's own memberships in this festival (joins to groups to filter by festival_id).
            if (fields.includes("groups!inner")) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue(
                    authorGroupsError
                      ? { data: null, error: new Error("boom") }
                      : {
                          data: authorGroupIds.map((groupId) => ({ group_id: groupId })),
                          error: null,
                        },
                  ),
                }),
              };
            }
            // Members of the author's groups, used to resolve the deep link.
            return {
              in: vi.fn().mockResolvedValue(
                coMembersError ? { data: null, error: new Error("boom") } : { data: coMembers, error: null },
              ),
            };
          }),
        };
      }

      // profiles
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { username: "nacho", full_name: "Nacho", avatar_url: null },
              error: null,
            }),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("NotificationService.notifyGroupMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
  });

  it("notifies everyone who shares a group with the author", async () => {
    mockAdminClientReturning([]);
    const service = new NotificationService(
      mockRequestScopedSupabase({
        viewers: [{ viewer_id: MATE_ID }],
        authorGroupIds: [GROUP_ID],
        coMembers: [{ user_id: MATE_ID, group_id: GROUP_ID }],
      }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "group-message",
        to: MATE_ID,
        payload: expect.objectContaining({ groupId: GROUP_ID }),
      }),
    );
  });

  it("never notifies the author", async () => {
    mockAdminClientReturning([]);
    const service = new NotificationService(
      mockRequestScopedSupabase({
        viewers: [{ viewer_id: MATE_ID }, { viewer_id: AUTHOR_ID }],
        authorGroupIds: [GROUP_ID],
        coMembers: [
          { user_id: MATE_ID, group_id: GROUP_ID },
          { user_id: AUTHOR_ID, group_id: GROUP_ID },
        ],
      }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({ to: MATE_ID }));
  });

  it("drops recipients who switched group notifications off", async () => {
    mockAdminClientReturning([{ user_id: MATE_ID, group_notifications_enabled: false }]);
    const service = new NotificationService(
      mockRequestScopedSupabase({ viewers: [{ viewer_id: MATE_ID }] }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("notifies recipients from every shared group, not just one", async () => {
    mockAdminClientReturning([]);
    const service = new NotificationService(
      mockRequestScopedSupabase({
        // MATE_ID and OTHER_MATE_ID each share a *different* group with the author.
        viewers: [{ viewer_id: MATE_ID }, { viewer_id: OTHER_MATE_ID }],
        authorGroupIds: [GROUP_ID, OTHER_GROUP_ID],
        coMembers: [
          { user_id: MATE_ID, group_id: GROUP_ID },
          { user_id: OTHER_MATE_ID, group_id: OTHER_GROUP_ID },
        ],
      }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    // If only one shared group contributed recipients, one of these would be missing.
    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: MATE_ID, payload: expect.objectContaining({ groupId: GROUP_ID }) }),
    );
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: OTHER_MATE_ID,
        payload: expect.objectContaining({ groupId: OTHER_GROUP_ID }),
      }),
    );
  });

  it("keeps the first shared group when a recipient is in several with the author", async () => {
    mockAdminClientReturning([]);
    const service = new NotificationService(
      mockRequestScopedSupabase({
        viewers: [{ viewer_id: MATE_ID }],
        authorGroupIds: [GROUP_ID, OTHER_GROUP_ID],
        coMembers: [
          { user_id: MATE_ID, group_id: GROUP_ID },
          { user_id: MATE_ID, group_id: OTHER_GROUP_ID },
        ],
      }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ groupId: GROUP_ID }) }),
    );
  });

  it("still sends the push without a deep link when the shared group can't be resolved", async () => {
    mockAdminClientReturning([]);
    const service = new NotificationService(
      mockRequestScopedSupabase({
        viewers: [{ viewer_id: MATE_ID }],
        // No author group memberships resolved for this festival — degrade
        // gracefully rather than skipping the recipient.
        authorGroupIds: [],
        coMembers: [],
      }),
      "test-novu-key",
    );

    await service.notifyGroupMessage({
      authorId: AUTHOR_ID,
      festivalId: FESTIVAL_ID,
      messageType: "message",
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    const [call] = triggerMock.mock.calls;
    expect(call[0]).toEqual(
      expect.objectContaining({ to: MATE_ID, workflowId: "group-message" }),
    );
    expect(call[0].payload).not.toHaveProperty("groupId");
  });
});
