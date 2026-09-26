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

const TAGGER = "11111111-1111-4111-8111-111111111111";
const MATE = "22222222-2222-4222-8222-222222222222";
const FRIEND = "33333333-3333-4333-8333-333333333333";
const PHOTO = "44444444-4444-4444-8444-444444444444";
const FESTIVAL = "55555555-5555-4555-8555-555555555555";
const GROUP = "66666666-6666-4666-8666-666666666666";

/** A query builder that resolves to `result` however it is chained. */
function resolving(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return builder;
}

function mockAdmin({
  prefs = [],
  taggerGroups = [{ group_id: GROUP }],
  memberships = [{ user_id: MATE, group_id: GROUP }],
  globalSettings = null,
  hiddenGroups = [],
}: {
  prefs?: Array<{ user_id: string; group_notifications_enabled: boolean | null }>;
  taggerGroups?: Array<{ group_id: string }>;
  memberships?: Array<{ user_id: string; group_id: string }>;
  globalSettings?: { hide_photos_from_all_groups: boolean } | null;
  hiddenGroups?: Array<{ group_id: string }>;
} = {}) {
  const groupMembersSelect = vi
    .fn()
    .mockReturnValueOnce(resolving({ data: taggerGroups, error: null }))
    .mockReturnValueOnce(resolving({ data: memberships, error: null }));

  const client = {
    from: vi.fn((table: string) => {
      if (table === "user_notification_preferences") {
        return { select: vi.fn(() => resolving({ data: prefs, error: null })) };
      }
      if (table === "user_photo_global_settings") {
        return { select: vi.fn(() => resolving({ data: globalSettings, error: null })) };
      }
      if (table === "user_group_photo_settings") {
        return { select: vi.fn(() => resolving({ data: hiddenGroups, error: null })) };
      }
      return { select: groupMembersSelect };
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
}

function mockRequestScopedSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { username: "user1", full_name: "User 1", avatar_url: null },
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("NotificationService.notifyPhotoTag", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  it("tells each tagged person, with a shared group when there is one", async () => {
    mockAdmin();

    await service.notifyPhotoTag({
      photoId: PHOTO,
      taggerId: TAGGER,
      festivalId: FESTIVAL,
      taggedUserIds: [MATE, FRIEND],
    });

    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "photo-tag",
        to: MATE,
        payload: expect.objectContaining({
          type: "photo-tag",
          taggerName: "user1",
          taggerId: TAGGER,
          photoId: PHOTO,
          groupId: GROUP,
        }),
      }),
    );
    const friendCall = triggerMock.mock.calls.find(([request]) => request.to === FRIEND);
    expect(friendCall?.[0].payload).not.toHaveProperty("groupId");
  });

  it("respects people who turned group notifications off", async () => {
    mockAdmin({ prefs: [{ user_id: FRIEND, group_notifications_enabled: false }] });

    await service.notifyPhotoTag({
      photoId: PHOTO,
      taggerId: TAGGER,
      festivalId: FESTIVAL,
      taggedUserIds: [MATE, FRIEND],
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0][0].to).toBe(MATE);
  });

  it("never notifies the tagger", async () => {
    mockAdmin();

    await service.notifyPhotoTag({
      photoId: PHOTO,
      taggerId: TAGGER,
      festivalId: FESTIVAL,
      taggedUserIds: [TAGGER],
    });

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("does not link a group the tagger hid their photos from", async () => {
    mockAdmin({ hiddenGroups: [{ group_id: GROUP }] });

    await service.notifyPhotoTag({
      photoId: PHOTO,
      taggerId: TAGGER,
      festivalId: FESTIVAL,
      taggedUserIds: [MATE],
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0][0].payload).not.toHaveProperty("groupId");
  });

  it("does not link any group when the tagger hides photos from all groups", async () => {
    mockAdmin({ globalSettings: { hide_photos_from_all_groups: true } });

    await service.notifyPhotoTag({
      photoId: PHOTO,
      taggerId: TAGGER,
      festivalId: FESTIVAL,
      taggedUserIds: [MATE],
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0][0].payload).not.toHaveProperty("groupId");
  });

  it("keeps going when one send fails and never throws", async () => {
    mockAdmin();
    triggerMock.mockRejectedValueOnce(new Error("novu down"));

    await expect(
      service.notifyPhotoTag({
        photoId: PHOTO,
        taggerId: TAGGER,
        festivalId: FESTIVAL,
        taggedUserIds: [MATE, FRIEND],
      }),
    ).resolves.toBeUndefined();

    expect(triggerMock).toHaveBeenCalledTimes(2);
  });
});
