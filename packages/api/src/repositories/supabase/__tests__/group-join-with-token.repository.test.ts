/**
 * join_group_with_token reports failures in its payload rather than as errors.
 * "Already a member" covers a join that lost a race (a double tap on the invite
 * link, a retried request) and has to come back as the 409 the route documents
 * rather than a 500 (PROST-COUNTER-AF).
 */
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { ConflictError, DatabaseError, NotFoundError } from "../../../middleware/error";
import { SupabaseGroupRepository } from "../group.repository";

const TOKEN = "b0d2a1b9-7b1e-41cd-be6e-48418d0c6f11";
const USER = "00000000-0000-4000-8000-000000000001";

function repoWhoseRpcReturns(result: { data: unknown; error: unknown }) {
  const supabase = { rpc: async () => result } as unknown as SupabaseClient<Database>;
  return new SupabaseGroupRepository(supabase);
}

describe("SupabaseGroupRepository.joinWithToken", () => {
  it.each([
    ["already a member", { success: false, error_code: "ALREADY_MEMBER" }, ConflictError],
    ["an unknown token", { success: false, error_code: "TOKEN_NOT_FOUND" }, NotFoundError],
  ])("reports %s", async (_label, data, ErrorClass) => {
    const repo = repoWhoseRpcReturns({ data, error: null });

    await expect(repo.joinWithToken(TOKEN, USER)).rejects.toBeInstanceOf(ErrorClass);
  });

  it("surfaces an RPC failure as a database error", async () => {
    const repo = repoWhoseRpcReturns({ data: null, error: { message: "permission denied" } });

    await expect(repo.joinWithToken(TOKEN, USER)).rejects.toBeInstanceOf(DatabaseError);
  });
});
