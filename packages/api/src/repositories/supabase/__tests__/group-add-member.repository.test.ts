/**
 * addMember checks membership before inserting, so two joins racing (a double
 * tap on the invite link, or a retried request) both pass the check and the
 * second insert hits UNIQUE(user_id, group_id). That is the same "already a
 * member" the check reports, and it has to come back as the 409 the route
 * documents rather than a 500 (PROST-COUNTER-AF).
 */
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { ConflictError, DatabaseError } from "../../../middleware/error";
import { PgErrorCode } from "../../../lib/postgres-errors";
import { SupabaseGroupRepository } from "../group.repository";

const GROUP = "00000000-0000-4000-8000-0000000000ff";
const USER = "00000000-0000-4000-8000-000000000001";

function repoWhoseInsertFails(error: { code: string; message: string }) {
  const supabase = {
    from: () => ({ insert: async () => ({ error }) }),
  } as unknown as SupabaseClient<Database>;
  const repo = new SupabaseGroupRepository(supabase);
  vi.spyOn(repo, "isMember").mockResolvedValue(false);
  vi.spyOn(repo, "findById").mockResolvedValue({ id: GROUP } as Awaited<
    ReturnType<SupabaseGroupRepository["findById"]>
  >);
  return repo;
}

describe("SupabaseGroupRepository.addMember", () => {
  it("reports a join that lost the race as already a member", async () => {
    const repo = repoWhoseInsertFails({
      code: PgErrorCode.UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint "group_members_user_id_group_id_key"',
    });

    await expect(repo.addMember(GROUP, USER)).rejects.toBeInstanceOf(ConflictError);
  });

  it("still surfaces any other insert failure as a database error", async () => {
    const repo = repoWhoseInsertFails({ code: "42501", message: "permission denied" });

    await expect(repo.addMember(GROUP, USER)).rejects.toBeInstanceOf(DatabaseError);
  });
});
