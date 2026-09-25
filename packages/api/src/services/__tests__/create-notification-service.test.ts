import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../lib/logger";
import { createNotificationService, NotificationService } from "../notification.service";

vi.mock("@novu/api", () => ({
  Novu: class {},
}));

const supabase = {} as SupabaseClient<Database>;

describe("createNotificationService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds the service when the Novu key is set", () => {
    vi.stubEnv("NOVU_API_KEY", "test-key");

    expect(createNotificationService(supabase)).toBeInstanceOf(NotificationService);
  });

  it("returns null and warns only once when the key is missing", () => {
    vi.stubEnv("NOVU_API_KEY", "");
    const warn = vi.spyOn(logger, "warn");

    expect(createNotificationService(supabase)).toBeNull();
    expect(createNotificationService(supabase)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
