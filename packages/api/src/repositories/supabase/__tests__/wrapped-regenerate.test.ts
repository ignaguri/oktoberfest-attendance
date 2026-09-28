// Unit test for how regenerateCache splits its work.
//
// regenerate_wrapped_data_cache runs get_wrapped_data once per target inside a
// single statement, and the API calls it with the admin's JWT, so
// authenticated's 8s statement_timeout applies. Regenerating a whole festival
// (or everything) in one call would time out at production size, so the
// repository issues one call per (user, festival). A stubbed client is what
// lets the test count those calls.
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseWrappedRepository } from "../wrapped.repository";

type AttendanceRow = { user_id: string; festival_id: string };

function createStubClient(attendances: AttendanceRow[], pageSize = 1000) {
  const filters: Record<string, string> = {};

  const attendanceChain = {
    select: () => attendanceChain,
    eq: (column: string, value: string) => {
      filters[column] = value;
      return attendanceChain;
    },
    order: () => attendanceChain,
    range: (from: number, to: number) => {
      const matching = attendances.filter((row) =>
        Object.entries(filters).every(
          ([column, value]) => row[column as keyof AttendanceRow] === value,
        ),
      );
      return Promise.resolve({
        data: matching.slice(from, Math.min(to + 1, from + pageSize)),
        error: null,
      });
    },
  };

  const profileChain = {
    select: () => profileChain,
    eq: () => profileChain,
    single: () => Promise.resolve({ data: { is_super_admin: true }, error: null }),
  };

  const rpc = vi.fn(() => Promise.resolve({ data: 1, error: null }));
  const from = vi.fn((table: string) => (table === "profiles" ? profileChain : attendanceChain));

  return { client: { from, rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("SupabaseWrappedRepository.regenerateCache", () => {
  it("regenerates one (user, festival) pair per RPC call, deduplicating days", async () => {
    const { client, rpc } = createStubClient([
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u2", festival_id: "f1" },
      { user_id: "u1", festival_id: "f2" },
    ]);

    const count = await new SupabaseWrappedRepository(client).regenerateCache("admin");

    expect(count).toBe(3);
    expect(rpc).toHaveBeenCalledTimes(3);
    for (const call of rpc.mock.calls as unknown as [string, Record<string, string>][]) {
      expect(call[0]).toBe("regenerate_wrapped_data_cache");
      expect(call[1].p_user_id).toBeTruthy();
      expect(call[1].p_festival_id).toBeTruthy();
    }
  });

  it("pages through attendances past the PostgREST row cap", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      user_id: `u${index}`,
      festival_id: "f1",
    }));
    const { client, rpc } = createStubClient(rows, 2);

    const count = await new SupabaseWrappedRepository(client).regenerateCache("admin", "f1");

    expect(count).toBe(5);
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it("makes a single call when both user and festival are given", async () => {
    const { client, rpc } = createStubClient([]);

    await new SupabaseWrappedRepository(client).regenerateCache("admin", "f1", "u1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("regenerate_wrapped_data_cache", {
      p_user_id: "u1",
      p_festival_id: "f1",
    });
  });
});
