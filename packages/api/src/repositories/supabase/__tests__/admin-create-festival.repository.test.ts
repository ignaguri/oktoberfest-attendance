/**
 * festivals.short_name is UNIQUE, so creating a festival with a taken short
 * name is the admin asking for something impossible. It has to come back as a
 * 409 the app can explain, not a 500.
 */
import type { Database } from "@prostcounter/db";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { PgErrorCode } from "../../../lib/postgres-errors";
import { ConflictError } from "../../../middleware/error";
import { SupabaseAdminRepository } from "../admin.repository";

const INPUT = {
  name: "Oktoberfest 2027",
  short_name: "oktoberfest-2027",
  festival_type: "oktoberfest",
  location: "Munich",
  start_date: "2027-09-18",
  end_date: "2027-10-03",
  status: "upcoming",
} as const;

function repoWhoseInsertFails(error: { code: string; message: string }) {
  const query = {
    insert: () => query,
    select: () => query,
    single: async () => ({ data: null, error }),
  };
  const supabase = { from: () => query } as unknown as SupabaseClient<Database>;
  return new SupabaseAdminRepository(supabase);
}

describe("SupabaseAdminRepository.createFestival", () => {
  it("reports a taken short name as a conflict", async () => {
    const repo = repoWhoseInsertFails({
      code: PgErrorCode.UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint "festivals_short_name_key"',
    });

    const result = repo.createFestival(INPUT);

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({ code: ErrorCodes.FESTIVAL_SHORT_NAME_TAKEN });
  });

  it("still surfaces any other insert failure as an error", async () => {
    const repo = repoWhoseInsertFails({ code: "42501", message: "permission denied" });

    await expect(repo.createFestival(INPUT)).rejects.not.toBeInstanceOf(ConflictError);
  });
});
