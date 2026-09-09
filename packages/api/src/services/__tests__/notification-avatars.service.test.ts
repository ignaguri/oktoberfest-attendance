import type { Database } from "@prostcounter/db";
import { DEFAULT_AVATAR_URL } from "@prostcounter/shared/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "../../utils/admin-client";
import { NotificationService, resolveAvatarUrl } from "../notification.service";

const { triggerMock } = vi.hoisted(() => ({ triggerMock: vi.fn() }));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
  },
}));

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const JOINER_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const SUPABASE_URL = "https://project.supabase.co";
const AVATAR_FILE = "a9121324-7227-460b-89f6-1e366587d03c_1788951090348.webp";

/**
 * The Novu in-app step validates its avatar control against this format. A
 * bare filename fails it, which kills the whole step with
 * ExecutionStateOutputInvalidError and delivers nothing.
 */
function isAbsoluteUrl(value: unknown): boolean {
  return typeof value === "string" && URL.canParse(value);
}

function mockAdminClientReturning(rows: { user_id: string; group_join_enabled?: boolean }[]) {
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
}

/** Profiles carry only the filename, which is exactly what used to leak through. */
function mockSupabaseWithAvatar(avatarUrl: string | null) {
  return {
    from: vi.fn((table: string) => {
      const row =
        table === "groups"
          ? { name: "Wiesn Crew", created_by: ADMIN_ID }
          : { username: "joiner", full_name: "A Joiner", avatar_url: avatarUrl };

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("resolveAvatarUrl", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it("turns a stored filename into an absolute storage URL", () => {
    expect(resolveAvatarUrl(AVATAR_FILE)).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/avatars/${AVATAR_FILE}`,
    );
  });

  it("passes an OAuth provider's full URL through untouched", () => {
    const oauthAvatar = "https://lh3.googleusercontent.com/a/photo.jpg";

    expect(resolveAvatarUrl(oauthAvatar)).toBe(oauthAvatar);
  });

  it("falls back to the default avatar when the profile has none", () => {
    expect(resolveAvatarUrl(null)).toBe(DEFAULT_AVATAR_URL);
    expect(resolveAvatarUrl("")).toBe(DEFAULT_AVATAR_URL);
  });

  it("falls back rather than building a relative URL when no supabase URL is set", () => {
    const originalPublicUrl = process.env.SUPABASE_PUBLIC_URL;
    delete process.env.SUPABASE_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    try {
      expect(resolveAvatarUrl(AVATAR_FILE)).toBe(DEFAULT_AVATAR_URL);
    } finally {
      if (originalPublicUrl !== undefined) {
        process.env.SUPABASE_PUBLIC_URL = originalPublicUrl;
      }
    }
  });
});

describe("notification payload avatars", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    triggerMock.mockResolvedValue({ result: {} });
    mockAdminClientReturning([{ user_id: ADMIN_ID, group_join_enabled: true }]);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it("sends a friend request avatar Novu can accept", async () => {
    const service = new NotificationService(mockSupabaseWithAvatar(AVATAR_FILE), "test-novu-key");

    await service.notifyFriendRequest(JOINER_ID, ADMIN_ID);

    expect(triggerMock).toHaveBeenCalledTimes(1);
    const payload = triggerMock.mock.calls[0]![0].payload as { requesterAvatar: string };
    expect(isAbsoluteUrl(payload.requesterAvatar)).toBe(true);
    expect(payload.requesterAvatar).toContain(AVATAR_FILE);
  });

  it("sends a group join avatar Novu can accept", async () => {
    const service = new NotificationService(mockSupabaseWithAvatar(AVATAR_FILE), "test-novu-key");

    await service.notifyGroupJoin(GROUP_ID, JOINER_ID);

    expect(triggerMock).toHaveBeenCalledTimes(1);
    const payload = triggerMock.mock.calls[0]![0].payload as { joinerAvatar: string };
    expect(isAbsoluteUrl(payload.joinerAvatar)).toBe(true);
    expect(payload.joinerAvatar).toContain(AVATAR_FILE);
  });
});
