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

const UPLOADER_ID = "11111111-1111-4111-8111-111111111111";
const REACTOR_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const FESTIVAL_ID = "55555555-5555-4555-8555-555555555555";

const REACTION = {
  photoId: PHOTO_ID,
  groupId: GROUP_ID,
  reactorId: REACTOR_ID,
  emoji: "🍻",
};

/** The service-role client: the photo's uploader, preferences, and the dedupe ledger. */
function mockAdmin({
  uploaderId = UPLOADER_ID,
  visibility = "public",
  photoFestivalId = FESTIVAL_ID,
  uploaderInGroup = true,
  prefs = [],
  inserted = true,
}: {
  uploaderId?: string | null;
  visibility?: "public" | "private";
  photoFestivalId?: string;
  uploaderInGroup?: boolean;
  prefs?: Array<{ user_id: string; group_notifications_enabled: boolean | null }>;
  inserted?: boolean;
}) {
  const photoMaybeSingle = vi.fn().mockResolvedValue({
    data: uploaderId
      ? { user_id: uploaderId, visibility, attendances: { festival_id: photoFestivalId } }
      : null,
    error: null,
  });
  const membershipQuery = {
    eq: vi.fn(() => membershipQuery),
    maybeSingle: vi.fn().mockResolvedValue({
      data: uploaderInGroup ? { groups: { festival_id: FESTIVAL_ID } } : null,
      error: null,
    }),
  };
  const prefsIn = vi.fn().mockResolvedValue({ data: prefs, error: null });
  const ledgerSelect = vi
    .fn()
    .mockResolvedValue({ data: inserted ? [{ photo_id: PHOTO_ID }] : [], error: null });
  const upsert = vi.fn().mockReturnValue({ select: ledgerSelect });
  const ledgerDeleteQuery = {
    eq: vi.fn(() => ledgerDeleteQuery),
  };
  const ledgerDelete = vi.fn().mockReturnValue(ledgerDeleteQuery);

  const client = {
    from: vi.fn((table: string) => {
      if (table === "beer_pictures") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: photoMaybeSingle }),
          }),
        };
      }
      if (table === "group_members") {
        return { select: vi.fn().mockReturnValue(membershipQuery) };
      }
      if (table === "user_notification_preferences") {
        return { select: vi.fn().mockReturnValue({ in: prefsIn }) };
      }
      return { upsert, delete: ledgerDelete };
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);

  return { upsert, ledgerDelete, ledgerDeleteQuery };
}

/** The reactor's own client, which reads their profile. */
function mockRequestScopedSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { username: "user2", full_name: "User 2", avatar_url: null },
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("NotificationService.notifyPhotoReaction", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  it("tells the uploader who reacted and with what", async () => {
    const { upsert } = mockAdmin({});

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).toHaveBeenCalledWith(
      { photo_id: PHOTO_ID, reactor_id: REACTOR_ID },
      expect.objectContaining({ onConflict: "photo_id,reactor_id", ignoreDuplicates: true }),
    );
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "photo-reaction",
        to: UPLOADER_ID,
        payload: expect.objectContaining({
          type: "photo-reaction",
          reactorName: "user2",
          reactorId: REACTOR_ID,
          emoji: "🍻",
          groupId: GROUP_ID,
          photoId: PHOTO_ID,
        }),
      }),
    );
  });

  it("stays quiet when you react to your own photo", async () => {
    const { upsert } = mockAdmin({ uploaderId: REACTOR_ID });

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("respects an uploader who turned group notifications off", async () => {
    const { upsert } = mockAdmin({
      prefs: [{ user_id: UPLOADER_ID, group_notifications_enabled: false }],
    });

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("notifies once per reactor and photo, so changing a reaction stays quiet", async () => {
    mockAdmin({ inserted: false });

    await service.notifyPhotoReaction(REACTION);

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("skips a photo that no longer exists", async () => {
    mockAdmin({ uploaderId: null });

    await service.notifyPhotoReaction(REACTION);

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("skips a private photo", async () => {
    const { upsert } = mockAdmin({ visibility: "private" });

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("skips a photo whose uploader is not in the group", async () => {
    const { upsert } = mockAdmin({ uploaderInGroup: false });

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("skips a photo from another festival than the group's", async () => {
    const { upsert } = mockAdmin({ photoFestivalId: "66666666-6666-4666-8666-666666666666" });

    await service.notifyPhotoReaction(REACTION);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("forgets the ledger row when the send fails, so a later reaction can retry", async () => {
    triggerMock.mockRejectedValue(new Error("novu down"));
    const { ledgerDelete, ledgerDeleteQuery } = mockAdmin({});

    await expect(service.notifyPhotoReaction(REACTION)).resolves.toBeUndefined();

    expect(ledgerDelete).toHaveBeenCalled();
    expect(ledgerDeleteQuery.eq).toHaveBeenCalledWith("photo_id", PHOTO_ID);
    expect(ledgerDeleteQuery.eq).toHaveBeenCalledWith("reactor_id", REACTOR_ID);
  });
});
